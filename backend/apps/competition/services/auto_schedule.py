"""
Generación automática de jornadas.

Reparte los partidos del torneo que siguen en borrador y sin jornada en días de juego, a partir de una fecha de
apertura: una jornada por día de juego elegido. Reglas:

- Orden del fixture: fase regular por fecha (1, 2, …), luego la eliminación directa por ronda e ida/vuelta.
- Un equipo juega como máximo un partido por jornada.
- Cada cancha tiene su horario (por defecto de 9:00 a 18:00) y encadena sus partidos desde la hora de inicio
  (duración según las reglas de la categoría), con tantos en paralelo como su capacidad (mini canchas). Un
  partido entra si termina a más tardar 30 minutos después de la hora límite de la cancha.
  Se respetan los partidos que ya ocupan esa cancha ese día (de cualquier torneo).
- La eliminación directa de una categoría empieza en una jornada posterior al último partido de su fase
  regular (y cada ronda después de la anterior); la vuelta, en una jornada posterior a la ida.

`plan_matchdays` solo calcula (vista previa); `create_matchdays` lo guarda.
"""
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta
from datetime import timezone as dt_timezone

from django.core.exceptions import ValidationError
from django.db import transaction
from django.db.models import Max
from django.utils import timezone

from apps.audit.services import record
from apps.core.validators import reasonable_date_error
from apps.registry.models import Field
from apps.tournaments.models import Tournament

from ..models import KNOCKOUT_STAGES, Leg, Match, Matchday, Stage
from .scheduling import ACTIVE_STATUSES

OFFICIAL = dt_timezone(timedelta(hours=-4))  # hora oficial de Venezuela (UTC-4)
STAGE_RANK = {Stage.REGULAR: 0, **{stage: i + 1 for i, (stage, _) in enumerate(KNOCKOUT_STAGES)}}
MAX_DAYS = 400  # tope de días recorridos (evita bucles con configuraciones imposibles)
GRACE = timedelta(minutes=30)  # el último partido puede terminar hasta 30' después de la hora límite
DEFAULT_START, DEFAULT_END = time(9, 0), time(18, 0)
WEEKDAYS = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"]


@dataclass
class Slot:
    match: Match
    field: Field
    lane: int
    start: datetime
    end: datetime


def _duration(match: Match) -> timedelta:
    rules = match.tournament.rules_for(match.category)
    return timedelta(minutes=rules.match_duration_minutes + rules.break_minutes * max(0, rules.periods - 1))


def _parse_time(value, label: str) -> time:
    try:
        hours, minutes = (int(x) for x in str(value)[:5].split(":"))
        return time(hours, minutes)
    except (TypeError, ValueError):
        raise ValidationError({"fields": f"{label}: use el formato HH:MM."})


def _parse_days(days) -> set[int]:
    """Días de la semana en que se juega (lunes = 0). Acepta números o {"weekday": n}."""
    parsed = set()
    for item in days or []:
        try:
            weekday = int(item["weekday"] if isinstance(item, dict) else item)
        except (KeyError, TypeError, ValueError):
            raise ValidationError({"days": "Día de la semana inválido."})
        if not 0 <= weekday <= 6:
            raise ValidationError({"days": "Día de la semana inválido."})
        parsed.add(weekday)
    if not parsed:
        raise ValidationError({"days": "Elija al menos un día de juego."})
    return parsed


def _fields(tournament: Tournament, config) -> list[tuple[Field, time, time]]:
    """
    Canchas a usar con su horario: `config` = [{"id", "start": "HH:MM", "end": "HH:MM"}]. Sin config, todas las
    canchas del torneo (o todas las activas si el torneo no indicó) de 9:00 a 18:00.
    """
    available = Field.objects.filter(is_active=True)
    own = list(tournament.fields.values_list("id", flat=True))
    if own:
        available = available.filter(pk__in=own)
    available = {f.id: f for f in available}
    if config is None:
        chosen = [(f, DEFAULT_START, DEFAULT_END) for f in available.values()]
    else:
        chosen = []
        for item in config:
            try:
                field = available[int(item["id"] if isinstance(item, dict) else item)]
            except (KeyError, TypeError, ValueError):
                raise ValidationError({"fields": "Una de las canchas no está disponible para el torneo."})
            start = _parse_time(item.get("start", "09:00"), field.name) if isinstance(item, dict) else DEFAULT_START
            end = _parse_time(item.get("end", "18:00"), field.name) if isinstance(item, dict) else DEFAULT_END
            if end <= start:
                raise ValidationError({"fields": f"{field.name}: la hora límite debe ser posterior a la de inicio."})
            chosen.append((field, start, end))
    if not chosen:
        raise ValidationError({"fields": "No hay canchas disponibles para el torneo."})
    return sorted(chosen, key=lambda c: c[0].name)


def _lanes_for_day(fields: list[tuple[Field, time, time]], day: date) -> dict[int, list[datetime]]:
    """Hora libre de cada carril (mini cancha) por cancha, considerando los partidos que ya ocupan ese día."""
    lanes = {f.id: [datetime.combine(day, start, OFFICIAL)] * max(1, f.capacity) for f, start, _ in fields}
    day_start = datetime.combine(day, time(0, 0), OFFICIAL)
    busy = Match.objects.filter(field__in=[f for f, _, _ in fields], status__in=ACTIVE_STATUSES,
                                scheduled_end__gt=day_start, scheduled_start__lt=day_start + timedelta(days=1)
                                ).order_by("scheduled_start")
    for match in busy:
        field_lanes = lanes[match.field_id]
        index = min(max((match.sub_field or 1) - 1, 0), len(field_lanes) - 1)
        field_lanes[index] = max(field_lanes[index], match.scheduled_end)
    return lanes


def plan_matchdays(tournament: Tournament, *, start_date: date, days, fields=None, category_ids=None) -> dict:
    if error := reasonable_date_error(start_date):
        raise ValidationError({"start_date": error})
    if tournament.start_date and start_date < tournament.start_date:
        raise ValidationError({"start_date": f"El torneo empieza el {tournament.start_date:%d/%m/%Y}."})
    if tournament.end_date and start_date > tournament.end_date:
        raise ValidationError({"start_date": f"El torneo termina el {tournament.end_date:%d/%m/%Y}."})
    schedule = _parse_days(days)
    fields = _fields(tournament, fields)
    limit_of = {f.id: end for f, _, end in fields}

    pending_qs = (Match.objects.filter(tournament=tournament, status=Match.Status.DRAFT, matchday__isnull=True)
                  .select_related("tournament", "category", "home__team", "away__team")
                  .prefetch_related("tournament__category_rules"))
    if category_ids:
        pending_qs = pending_qs.filter(category_id__in=category_ids)
    pending = sorted(pending_qs, key=lambda m: (STAGE_RANK.get(m.stage, 99), m.round_number, m.leg or 0,
                                                m.category.name, m.bracket_position or 0, m.id))
    total = len(pending)
    taken = set(Matchday.objects.filter(tournament=tournament).values_list("date", flat=True))
    number = (Matchday.objects.filter(tournament=tournament).aggregate(n=Max("number"))["n"] or 0) + 1

    # Para la eliminación directa: cuántos partidos quedan por ubicar y en qué jornada del plan cayó el último,
    # por (categoría, fase); y en qué jornada del plan quedó cada ida.
    remaining: dict[tuple[int, int], int] = {}
    for m in pending:
        key = (m.category_id, STAGE_RANK.get(m.stage, 99))
        remaining[key] = remaining.get(key, 0) + 1
    last_day: dict[tuple[int, int], int] = {}
    first_leg_day: dict[tuple, int] = {}

    def allowed(m: Match, day_index: int) -> bool:
        rank = STAGE_RANK.get(m.stage, 99)
        for previous in range(rank):
            key = (m.category_id, previous)
            if remaining.get(key, 0) or last_day.get(key, -1) >= day_index:
                return False
        if m.leg == Leg.SECOND:
            ida = first_leg_day.get((m.category_id, m.stage, m.bracket_position))
            if ida is not None and ida >= day_index:
                return False
            if ida is None and any(p.leg == Leg.FIRST and p.stage == m.stage and p.category_id == m.category_id
                                   and p.bracket_position == m.bracket_position for p in pending):
                return False
        return True

    plan: list[dict] = []
    day = start_date
    empty_days = 0  # días de juego seguidos en que no cupo nada (horario demasiado corto, canchas ocupadas)
    for _ in range(MAX_DAYS):
        if not pending or (tournament.end_date and day > tournament.end_date):
            break
        if day.weekday() in schedule and day not in taken:
            day_index = len(plan)
            lanes = _lanes_for_day(fields, day)
            deadline = {fid: datetime.combine(day, end, OFFICIAL) + GRACE for fid, end in limit_of.items()}
            busy_teams: set[int] = set()
            slots: list[Slot] = []
            for m in list(pending):
                if not allowed(m, day_index):
                    continue
                teams = {m.home_id, m.away_id} - {None}
                if teams & busy_teams:
                    continue
                duration = _duration(m)
                # Carriles donde el partido termina a tiempo (hasta 30' después de la hora límite de la cancha).
                options = [(free, f.name, f, lane) for f, _, _ in fields for lane, free in enumerate(lanes[f.id])
                           if free + duration <= deadline[f.id]]
                if not options:
                    continue  # no cabe hoy; uno más corto (otra categoría) quizá sí
                start, _, field, lane = min(options, key=lambda o: (o[0], o[1], o[3]))
                end = start + duration
                lanes[field.id][lane] = end
                busy_teams |= teams
                slots.append(Slot(m, field, lane, start, end))
                pending.remove(m)
                # Al momento: así la ronda siguiente o la vuelta no caen en esta misma jornada.
                key = (m.category_id, STAGE_RANK.get(m.stage, 99))
                remaining[key] -= 1
                last_day[key] = day_index
                if m.leg == Leg.FIRST:
                    first_leg_day[(m.category_id, m.stage, m.bracket_position)] = day_index
            if not slots:
                empty_days += 1
                if empty_days >= 8 or not any(allowed(m, day_index) for m in pending):
                    break  # el horario de las canchas no alcanza para ningún partido pendiente
            else:
                empty_days = 0
                plan.append({"date": day, "number": number + day_index, "slots": slots})
        day += timedelta(days=1)

    warnings = []
    if pending:
        limit = f" antes del fin del torneo ({tournament.end_date:%d/%m/%Y})" if tournament.end_date else ""
        warnings.append(f"Quedan {len(pending)} partido(s) sin ubicar{limit}: agregue días de juego o canchas, amplíe el horario "
                        "de las canchas, o genere más jornadas después.")
    skipped = sorted(d for d in taken if d >= start_date and d.weekday() in schedule)
    if skipped:
        warnings.append(f"Se saltaron {len(skipped)} día(s) que ya tienen jornada en este torneo.")
    return {"plan": plan, "total": total, "pending": pending, "warnings": warnings}


def serialize_plan(result: dict, created: list[Matchday] | None = None) -> dict:
    days = []
    for index, entry in enumerate(result["plan"]):
        slots = sorted(entry["slots"], key=lambda s: (s.field.name, s.start))
        days.append({
            "id": created[index].id if created else None,
            "number": entry["number"],
            "date": entry["date"].isoformat(),
            "weekday": WEEKDAYS[entry["date"].weekday()],
            "start": min(s.start for s in slots).astimezone(OFFICIAL).strftime("%H:%M"),
            "end": max(s.end for s in slots).astimezone(OFFICIAL).strftime("%H:%M"),
            "matches": [{
                "id": s.match.id, "home": s.match.home_label, "away": s.match.away_label,
                "category": s.match.category.name,
                "phase": f"Fecha {s.match.round_number}" if s.match.stage == Stage.REGULAR
                else f"{s.match.get_stage_display()}{f' · {s.match.get_leg_display()}' if s.match.leg else ''}",
                "field": s.field.name, "sub_field": s.lane + 1 if s.field.capacity > 1 else None,
                "start": s.start.astimezone(OFFICIAL).isoformat(), "end": s.end.astimezone(OFFICIAL).isoformat(),
            } for s in slots],
        })
    return {"days": days, "total": result["total"], "scheduled": sum(len(d["matches"]) for d in days),
            "unscheduled": len(result["pending"]), "warnings": result["warnings"]}


@transaction.atomic
def create_matchdays(tournament: Tournament, user, **options) -> dict:
    """
    Calcula el plan y crea las jornadas en borrador con sus partidos ya en cancha y horario. Todo en lote (pocas
    consultas aunque sean miles de partidos): uno a uno no entra en el tiempo de una petición en Vercel. La
    auditoría queda en un solo registro con el detalle de jornadas y partidos.
    """
    result = plan_matchdays(tournament, **options)
    if not result["plan"]:
        raise ValidationError("No hay partidos para ubicar con esa configuración.")
    created = Matchday.objects.bulk_create([
        Matchday(tournament=tournament, number=entry["number"], date=entry["date"], created_by=user)
        for entry in result["plan"]
    ])
    updated, now = [], timezone.now()  # bulk_update no aplica auto_now
    for matchday, entry in zip(created, result["plan"]):
        for slot in entry["slots"]:
            m = slot.match
            m.matchday, m.field = matchday, slot.field
            m.sub_field = slot.lane + 1 if slot.field.capacity > 1 else None
            m.scheduled_start, m.scheduled_end = slot.start, slot.end
            m.updated_at = now
            updated.append(m)
    Match.objects.bulk_update(updated, ["matchday", "field", "sub_field", "scheduled_start", "scheduled_end",
                                        "updated_at"], batch_size=500)
    record("auto_schedule", tournament, user=user, changes={
        "jornadas": [{"numero": md.number, "dia": md.date.isoformat(), "partidos": len(e["slots"])}
                     for md, e in zip(created, result["plan"])],
        "partidos": len(updated), "desde": options["start_date"].isoformat(),
        "canchas": [{"cancha": f.name, "desde": start.strftime("%H:%M"), "hasta": end.strftime("%H:%M")}
                    for f, start, end in _fields(tournament, options.get("fields"))],
    })
    return serialize_plan(result, created)
