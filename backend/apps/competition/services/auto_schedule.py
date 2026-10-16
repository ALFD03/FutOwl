"""
Generación automática de jornadas.

Reparte los partidos del torneo que siguen en borrador y sin jornada a partir de una fecha de apertura: una
jornada por cada día en que al menos una cancha se puede usar. Cada cancha dice qué días de la semana se juega en
ella (por defecto todos). Reglas:

- Orden del fixture: fase regular por fecha (1, 2, …), luego la eliminación directa por ronda e ida/vuelta.
- Un equipo juega como máximo un partido por jornada.
- Cada cancha tiene su horario (por defecto de 9:00 a 18:00) y encadena sus partidos desde la hora de inicio
  (duración según las reglas de la categoría). Si es divisible, juegan varios a la vez según las medidas de
  juego de cada categoría: cada partido ocupa 1/capacidad de la cancha (8 de una Sub 6 o 2 de una Sub 12) y se
  pueden mezclar categorías mientras la suma no pase de la cancha completa. Un partido entra si termina a más
  tardar 30 minutos después de la hora límite de la cancha.
- Misma capacidad toda la jornada (`same_capacity`, activo por defecto): una cancha divisible se arma una sola vez
  por día. El primer partido que se ubica en ella fija cuántos se juegan a la vez (p. ej. 4) y ese día solo recibe
  partidos de categorías con esa misma capacidad en la cancha; las demás van a otra cancha u otra jornada.
  Se respetan los partidos que ya ocupan esa cancha ese día (de cualquier torneo).
- La eliminación directa de una categoría empieza en una jornada posterior al último partido de su fase
  regular (y cada ronda después de la anterior); la vuelta, en una jornada posterior a la ida.

`plan_matchdays` solo calcula (vista previa); `create_matchdays` lo guarda.
"""
from collections import Counter
from dataclasses import dataclass, field as dc_field
from datetime import date, datetime, time, timedelta
from datetime import timezone as dt_timezone
from fractions import Fraction

from django.core.exceptions import ValidationError
from django.db import transaction
from django.db.models import Max
from django.utils import timezone

from apps.audit.services import record
from apps.core.validators import reasonable_date_error
from apps.registry.models import Field
from apps.tournaments.models import Tournament

from ..models import KNOCKOUT_STAGES, Leg, Match, Matchday, Stage
from .scheduling import ACTIVE_STATUSES, free_sub_field, peak_load

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
    sub_field: int | None
    start: datetime
    end: datetime


@dataclass
class FieldDay:
    """Ocupación de una cancha en un día: (inicio, fin, fracción de la cancha, capacidad, mini cancha)."""
    field: Field
    opens: datetime
    deadline: datetime
    busy: list[tuple[datetime, datetime, Fraction, int, int | None]] = dc_field(default_factory=list)
    version: int = 0
    mode: int | None = None  # partidos a la vez con que quedó armada la cancha ese día

    def accepts(self, capacity: int, same_capacity: bool) -> bool:
        return not same_capacity or self.mode is None or self.mode == capacity

    def copy(self) -> "FieldDay":
        return FieldDay(self.field, self.opens, self.deadline, list(self.busy), 0, self.mode)

    def earliest(self, duration: timedelta, capacity: int) -> tuple[datetime, int | None] | None:
        """Primera hora (y mini cancha) en que entra un partido de esa duración y capacidad, o None."""
        share = Fraction(1, capacity)
        candidates = sorted({self.opens} | {e for _, e, _, _, _ in self.busy if e > self.opens})
        for start in candidates:
            end = start + duration
            if end > self.deadline:
                return None
            overlapping = [b for b in self.busy if b[0] < end and b[1] > start]
            if peak_load([b[:3] for b in overlapping], start, end) + share > 1:
                continue
            if capacity == 1:
                return start, None
            sub = free_sub_field({b[4] or 1 for b in overlapping if b[3] == capacity}, capacity)
            if sub is not None:
                return start, sub
        return None


def _duration(match: Match) -> timedelta:
    rules = match.tournament.rules_for(match.category)
    return timedelta(minutes=rules.match_duration_minutes + rules.break_minutes * max(0, rules.periods - 1))


def _parse_time(value, label: str) -> time:
    try:
        hours, minutes = (int(x) for x in str(value)[:5].split(":"))
        return time(hours, minutes)
    except (TypeError, ValueError):
        raise ValidationError({"fields": f"{label}: use el formato HH:MM."})


ALL_DAYS = frozenset(range(7))


def _parse_days(days, label: str = "") -> set[int]:
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
        raise ValidationError({"days": f"{label}: elija al menos un día de juego." if label
                               else "Elija al menos un día de juego."})
    return parsed


@dataclass
class FieldPlan:
    """Cancha elegida para el generador, con su horario y los días de la semana en que se puede jugar en ella."""
    field: Field
    start: time
    end: time
    weekdays: frozenset[int]


def _fields(tournament: Tournament, config, default_days=None) -> list[FieldPlan]:
    """
    Canchas a usar: `config` = [{"id", "start": "HH:MM", "end": "HH:MM", "days": [0..6]}]. Cada cancha dice qué
    días de la semana se puede jugar en ella (por defecto todos, o `default_days`) y en qué horario (por defecto
    de 9:00 a 18:00). Sin config, todas las canchas del torneo (o todas las activas si el torneo no indicó).
    """
    available = Field.objects.filter(is_active=True)
    own = list(tournament.fields.values_list("id", flat=True))
    if own:
        available = available.filter(pk__in=own)
    available = {f.id: f for f in available}
    weekdays = frozenset(_parse_days(default_days)) if default_days else ALL_DAYS
    if config is None:
        chosen = [FieldPlan(f, DEFAULT_START, DEFAULT_END, weekdays) for f in available.values()]
    else:
        chosen = []
        for item in config:
            item = item if isinstance(item, dict) else {"id": item}
            try:
                field = available[int(item["id"])]
            except (KeyError, TypeError, ValueError):
                raise ValidationError({"fields": "Una de las canchas no está disponible para el torneo."})
            start = _parse_time(item.get("start", "09:00"), field.name)
            end = _parse_time(item.get("end", "18:00"), field.name)
            if end <= start:
                raise ValidationError({"fields": f"{field.name}: la hora límite debe ser posterior a la de inicio."})
            days = frozenset(_parse_days(item["days"], field.name)) if "days" in item else weekdays
            chosen.append(FieldPlan(field, start, end, days))
    if not chosen:
        raise ValidationError({"fields": "No hay canchas disponibles para el torneo."})
    return sorted(chosen, key=lambda c: c.field.name)


def _fields_for_day(fields: list[FieldPlan], day: date) -> dict[int, FieldDay]:
    """
    Canchas que se pueden usar ese día de la semana, con su horario y ocupación (los partidos que ya las usan, de
    cualquier torneo).
    """
    fields = [fp for fp in fields if day.weekday() in fp.weekdays]
    days = {fp.field.id: FieldDay(fp.field, datetime.combine(day, fp.start, OFFICIAL),
                                  datetime.combine(day, fp.end, OFFICIAL) + GRACE) for fp in fields}
    day_start = datetime.combine(day, time(0, 0), OFFICIAL)
    busy = (Match.objects.filter(field__in=[fp.field for fp in fields], status__in=ACTIVE_STATUSES,
                                 scheduled_end__gt=day_start, scheduled_start__lt=day_start + timedelta(days=1))
            .select_related("tournament", "category").prefetch_related("tournament__category_rules"))
    for match in busy:
        fd = days[match.field_id]
        capacity = fd.field.capacity_for(match.rules)
        fd.busy.append((match.scheduled_start, match.scheduled_end, Fraction(1, capacity), capacity, match.sub_field))
    for fd in days.values():  # la cancha ya armada ese día (por otro torneo) conserva su capacidad
        if fd.busy:
            fd.mode = Counter(b[3] for b in fd.busy).most_common(1)[0][0]
    return days


def _assign_modes(field_days: dict[int, FieldDay], demand: list[Slot]) -> None:
    """
    Arma cada cancha libre del día para una sola cantidad de partidos a la vez, repartiendo las canchas según lo
    que pide el día (`demand`: el día ubicado sin esta regla). Cada cancha va a la capacidad con más tiempo de
    cancha pendiente, como se reparte la carga entre máquinas; así una Sub 6 (8 a la vez) y una Sub 16 (cancha
    completa) tienen cada una sus canchas en lugar de quedarse con todas la primera categoría del fixture.
    Las canchas que sobran quedan libres: las arma el primer partido que se ubique en ellas.
    """
    left = [(s.match.tournament.rules_for(s.match.category), s.end - s.start) for s in demand]
    free = sorted((fd for fd in field_days.values() if fd.mode is None), key=lambda fd: fd.field.name)
    served: set[int] = set()  # capacidades que ya tienen cancha
    while free and left:
        best = None
        for fd in free:
            need: dict[int, timedelta] = {}
            for rules, duration in left:
                capacity = fd.field.capacity_for(rules)
                need[capacity] = need.get(capacity, timedelta()) + duration / capacity
            # Primero una cancha para cada capacidad que pide el día; después, a la que más tiempo pide.
            capacity, total = max(need.items(), key=lambda item: (item[0] not in served, item[1]))
            score = (capacity not in served, total)
            if best is None or score > best[0]:
                best = (score, fd, capacity)
        _, fd, capacity = best
        served.add(capacity)
        fd.mode = capacity
        free.remove(fd)
        window, rest = fd.deadline - fd.opens, []
        for rules, duration in left:  # lo que cubre esta cancha deja de pedir cancha
            if fd.field.capacity_for(rules) == capacity and duration / capacity <= window:
                window -= duration / capacity
            else:
                rest.append((rules, duration))
        left = rest


def plan_matchdays(tournament: Tournament, *, start_date: date, days=None, fields=None, category_ids=None,
                   same_capacity: bool = True) -> dict:
    if error := reasonable_date_error(start_date):
        raise ValidationError({"start_date": error})
    if tournament.start_date and start_date < tournament.start_date:
        raise ValidationError({"start_date": f"El torneo empieza el {tournament.start_date:%d/%m/%Y}."})
    if tournament.end_date and start_date > tournament.end_date:
        raise ValidationError({"start_date": f"El torneo termina el {tournament.end_date:%d/%m/%Y}."})
    fields = _fields(tournament, fields, days)
    schedule = set().union(*(fp.weekdays for fp in fields))  # días en que al menos una cancha se puede usar

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

    def place_day(day_index: int, field_days: dict[int, FieldDay], lock_modes: bool) -> list[Slot]:
        """Ubica en el día los partidos pendientes que se puedan (actualiza el estado del plan)."""
        earliest: dict[tuple, tuple] = {}  # (cancha, duración, capacidad) → (versión, resultado)
        busy_teams: set[int] = set()
        slots: list[Slot] = []
        for m in list(pending):
            if not allowed(m, day_index):
                continue
            teams = {m.home_id, m.away_id} - {None}
            if teams & busy_teams:
                continue
            duration, rules = _duration(m), m.tournament.rules_for(m.category)
            # Hora más temprana en cada cancha en que entra y termina a tiempo (hasta 30' tras la hora límite).
            options = []
            for fd in field_days.values():
                capacity = fd.field.capacity_for(rules)
                if not fd.accepts(capacity, lock_modes):
                    continue  # la cancha ya está armada ese día para otra cantidad de partidos a la vez
                cache_key = (fd.field.id, duration, capacity)
                if cache_key not in earliest or earliest[cache_key][0] != fd.version:
                    earliest[cache_key] = (fd.version, fd.earliest(duration, capacity))
                if found := earliest[cache_key][1]:
                    options.append((found[0], fd.field.name, fd, found[1], capacity))
            if not options:
                continue  # no cabe hoy; uno más corto o más pequeño (otra categoría) quizá sí
            start, _, fd, sub, capacity = min(options, key=lambda o: (o[0], o[1]))
            end = start + duration
            fd.busy.append((start, end, Fraction(1, capacity), capacity, sub))
            fd.version += 1
            fd.mode = fd.mode or capacity
            busy_teams |= teams
            slots.append(Slot(m, fd.field, sub, start, end))
            pending.remove(m)
            # Al momento: así la ronda siguiente o la vuelta no caen en esta misma jornada.
            key = (m.category_id, STAGE_RANK.get(m.stage, 99))
            remaining[key] -= 1
            last_day[key] = day_index
            if m.leg == Leg.FIRST:
                first_leg_day[(m.category_id, m.stage, m.bracket_position)] = day_index
        return slots

    def trial_day(day_index: int, field_days: dict[int, FieldDay]) -> list[Slot]:
        """Lo que entraría en el día sin armar las canchas (y sin tocar el plan): mide la demanda del día."""
        saved = dict(remaining), dict(last_day), dict(first_leg_day), list(pending)
        slots = place_day(day_index, {fid: fd.copy() for fid, fd in field_days.items()}, lock_modes=False)
        for target, copy in zip((remaining, last_day, first_leg_day), saved[:3]):
            target.clear()
            target.update(copy)
        pending[:] = saved[3]
        return slots

    plan: list[dict] = []
    day = start_date
    empty_days = 0  # días de juego seguidos en que no cupo nada (horario demasiado corto, canchas ocupadas)
    for _ in range(MAX_DAYS):
        if not pending or (tournament.end_date and day > tournament.end_date):
            break
        if day.weekday() in schedule and day not in taken:
            day_index = len(plan)
            field_days = _fields_for_day(fields, day)
            if same_capacity:
                _assign_modes(field_days, trial_day(day_index, field_days))
            slots = place_day(day_index, field_days, lock_modes=same_capacity)
            if not slots:
                empty_days += 1
                if empty_days >= 8 or not any(allowed(m, day_index) for m in pending):
                    break  # el horario de las canchas no alcanza para ningún partido pendiente
            else:
                empty_days = 0
                used = {s.field.id for s in slots}
                plan.append({"date": day, "number": number + day_index, "slots": slots,
                             "modes": {fd.field.name: fd.mode for fd in field_days.values() if fd.field.id in used}})
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
            "fields": [{"field": name, "at_once": mode} for name, mode in sorted(entry.get("modes", {}).items())],
            "matches": [{
                "id": s.match.id, "home": s.match.home_label, "away": s.match.away_label,
                "category": s.match.category.name,
                "phase": f"Fecha {s.match.round_number}" if s.match.stage == Stage.REGULAR
                else f"{s.match.get_stage_display()}{f' · {s.match.get_leg_display()}' if s.match.leg else ''}",
                "field": s.field.name, "sub_field": s.sub_field,
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
            m.sub_field = slot.sub_field
            m.scheduled_start, m.scheduled_end = slot.start, slot.end
            m.updated_at = now
            updated.append(m)
    Match.objects.bulk_update(updated, ["matchday", "field", "sub_field", "scheduled_start", "scheduled_end",
                                        "updated_at"], batch_size=500)
    record("auto_schedule", tournament, user=user, changes={
        "jornadas": [{"numero": md.number, "dia": md.date.isoformat(), "partidos": len(e["slots"])}
                     for md, e in zip(created, result["plan"])],
        "partidos": len(updated), "desde": options["start_date"].isoformat(),
        "misma_capacidad_por_cancha": options.get("same_capacity", True),
        "canchas": [{"cancha": fp.field.name, "desde": fp.start.strftime("%H:%M"), "hasta": fp.end.strftime("%H:%M"),
                     "dias": [WEEKDAYS[d] for d in sorted(fp.weekdays)]}
                    for fp in _fields(tournament, options.get("fields"), options.get("days"))],
    })
    return serialize_plan(result, created)
