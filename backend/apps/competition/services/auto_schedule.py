"""
Generación automática de jornadas.

Reparte los partidos del torneo que siguen en borrador y sin jornada en días de juego, a partir de una fecha de
apertura: una jornada por día elegido, con su hora de inicio. Reglas:

- Orden del fixture: fase regular por fecha (1, 2, …), luego la eliminación directa por ronda e ida/vuelta.
- Un equipo juega como máximo un partido por jornada.
- Cada cancha encadena sus partidos desde la hora de inicio (duración según las reglas de la categoría), con
  tantos en paralelo como su capacidad (mini canchas) y hasta el máximo de partidos por cancha indicado.
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

from apps.audit.services import record
from apps.core.validators import reasonable_date_error
from apps.registry.models import Field
from apps.tournaments.models import Tournament

from ..models import KNOCKOUT_STAGES, Leg, Match, Matchday, Stage
from .scheduling import ACTIVE_STATUSES

OFFICIAL = dt_timezone(timedelta(hours=-4))  # hora oficial de Venezuela (UTC-4)
STAGE_RANK = {Stage.REGULAR: 0, **{stage: i + 1 for i, (stage, _) in enumerate(KNOCKOUT_STAGES)}}
MAX_DAYS = 400  # tope de días recorridos (evita bucles con configuraciones imposibles)
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


def _parse_days(days) -> dict[int, time]:
    """[{"weekday": 0-6 (lunes = 0), "start": "HH:MM"}] → {weekday: hora}."""
    parsed = {}
    for item in days or []:
        try:
            weekday = int(item["weekday"])
            hours, minutes = (int(x) for x in str(item["start"])[:5].split(":"))
            parsed[weekday] = time(hours, minutes)
        except (KeyError, TypeError, ValueError):
            raise ValidationError({"days": "Cada día de juego necesita el día de la semana y la hora de inicio (HH:MM)."})
        if not 0 <= weekday <= 6:
            raise ValidationError({"days": "Día de la semana inválido."})
    if not parsed:
        raise ValidationError({"days": "Elija al menos un día de juego."})
    return parsed


def _fields(tournament: Tournament, field_ids) -> list[Field]:
    fields = Field.objects.filter(is_active=True)
    own = list(tournament.fields.values_list("id", flat=True))
    if own:
        fields = fields.filter(pk__in=own)
    if field_ids:
        fields = fields.filter(pk__in=field_ids)
    fields = list(fields.order_by("name"))
    if not fields:
        raise ValidationError({"fields": "No hay canchas disponibles para el torneo."})
    return fields


def _lanes_for_day(fields: list[Field], day_start: datetime) -> dict[int, list[datetime]]:
    """Hora libre de cada carril (mini cancha) por cancha, considerando los partidos que ya ocupan ese día."""
    lanes = {f.id: [day_start] * max(1, f.capacity) for f in fields}
    day_end = day_start.replace(hour=23, minute=59)
    busy = Match.objects.filter(field__in=fields, status__in=ACTIVE_STATUSES, scheduled_end__gt=day_start,
                                scheduled_start__lt=day_end).order_by("scheduled_start")
    for match in busy:
        field_lanes = lanes[match.field_id]
        index = min(max((match.sub_field or 1) - 1, 0), len(field_lanes) - 1)
        field_lanes[index] = max(field_lanes[index], match.scheduled_end)
    return lanes


def plan_matchdays(tournament: Tournament, *, start_date: date, days, max_per_field: int, field_ids=None,
                   category_ids=None) -> dict:
    if error := reasonable_date_error(start_date):
        raise ValidationError({"start_date": error})
    if tournament.start_date and start_date < tournament.start_date:
        raise ValidationError({"start_date": f"El torneo empieza el {tournament.start_date:%d/%m/%Y}."})
    if tournament.end_date and start_date > tournament.end_date:
        raise ValidationError({"start_date": f"El torneo termina el {tournament.end_date:%d/%m/%Y}."})
    if not isinstance(max_per_field, int) or max_per_field < 1:
        raise ValidationError({"max_per_field": "Indique cuántos partidos como máximo por cancha en cada jornada."})
    schedule = _parse_days(days)
    fields = _fields(tournament, field_ids)

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
    for _ in range(MAX_DAYS):
        if not pending or (tournament.end_date and day > tournament.end_date):
            break
        if day.weekday() in schedule and day not in taken:
            day_index = len(plan)
            day_start = datetime.combine(day, schedule[day.weekday()], OFFICIAL)
            lanes = _lanes_for_day(fields, day_start)
            counts = {f.id: 0 for f in fields}
            busy_teams: set[int] = set()
            slots: list[Slot] = []
            for m in list(pending):
                if not allowed(m, day_index):
                    continue
                teams = {m.home_id, m.away_id} - {None}
                if teams & busy_teams:
                    continue
                options = [(free, f.name, f, lane) for f in fields if counts[f.id] < max_per_field
                           for lane, free in enumerate(lanes[f.id])]
                if not options:
                    break  # todas las canchas llegaron al máximo de la jornada
                start, _, field, lane = min(options, key=lambda o: (o[0], o[1], o[3]))
                end = start + _duration(m)
                lanes[field.id][lane] = end
                counts[field.id] += 1
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
                if not any(allowed(m, day_index) for m in pending):
                    break  # nada puede avanzar (no debería ocurrir)
            else:
                plan.append({"date": day, "number": number + day_index, "start": schedule[day.weekday()], "slots": slots})
        day += timedelta(days=1)

    warnings = []
    if pending:
        limit = f" antes del fin del torneo ({tournament.end_date:%d/%m/%Y})" if tournament.end_date else ""
        warnings.append(f"Quedan {len(pending)} partido(s) sin ubicar{limit}: agregue días de juego, canchas o "
                        "partidos por cancha, o genere más jornadas después.")
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
            "start": entry["start"].strftime("%H:%M"),
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
    """Calcula el plan y crea las jornadas en borrador con sus partidos ya en cancha y horario."""
    result = plan_matchdays(tournament, **options)
    if not result["plan"]:
        raise ValidationError("No hay partidos para ubicar con esa configuración.")
    created = []
    for entry in result["plan"]:
        matchday = Matchday.objects.create(tournament=tournament, number=entry["number"], date=entry["date"],
                                           created_by=user)
        created.append(matchday)
        for slot in entry["slots"]:
            m = slot.match
            m.matchday, m.field = matchday, slot.field
            m.sub_field = slot.lane + 1 if slot.field.capacity > 1 else None
            m.scheduled_start, m.scheduled_end = slot.start, slot.end
            m.save(update_fields=["matchday", "field", "sub_field", "scheduled_start", "scheduled_end", "updated_at"])
    record("auto_schedule", tournament, user=user, changes={
        "jornadas": len(created), "partidos": sum(len(e["slots"]) for e in result["plan"]),
        "desde": options["start_date"].isoformat(), "max_por_cancha": options["max_per_field"],
    })
    return serialize_plan(result, created)
