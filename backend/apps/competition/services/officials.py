"""
Asignación automática de delegados y árbitros a los partidos de una jornada enviada.

Reglas:
- Cada oficial trabaja en una sola cancha por día y no puede estar en dos partidos a la vez (ni ocupar dos
  posiciones del mismo partido).
- El reparto es equitativo: los oficiales se distribuyen entre las canchas según el trabajo de cada una, de modo
  que todos tengan una carga parecida. Lo ideal es no pasar de DAILY_TARGET partidos por persona; si la jornada
  pide más, la carga sube para todos por igual.
- Solo se llenan posiciones vacías: lo ya asignado (también en otros torneos el mismo día) se respeta y cuenta
  como carga y como cancha del día de ese oficial. A igual carga, va primero quien lleva menos partidos en el torneo.
"""
from collections import Counter, defaultdict
from dataclasses import dataclass, field as dc_field

from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone

from apps.audit.services import record
from apps.notifications.services import notify
from apps.registry.models import Delegate, Referee

from ..models import Match, Matchday
from .scheduling import ACTIVE_STATUSES, REFEREE_FIELDS

DAILY_TARGET = 4

POSITION_LABELS = {"delegate": "delegado", "referee": "árbitro principal",
                   "assistant_referee_1": "asistente 1", "assistant_referee_2": "asistente 2"}


@dataclass
class Role:
    key: str
    label: str
    model: type
    all_positions: list[str]

    def positions(self, match: Match) -> list[str]:
        """Posiciones que exige el partido para este tipo de oficial."""
        if self.key == "delegate":
            return ["delegate"]
        return REFEREE_FIELDS[: match.rules.referees_required]


ROLES = {
    "delegate": Role("delegate", "delegados", Delegate, ["delegate"]),
    "referees": Role("referees", "árbitros", Referee, REFEREE_FIELDS),
}


@dataclass
class Day:
    """Situación de un tipo de oficial en el día: intervalos ocupados, canchas usadas y carga de cada uno."""
    busy: dict = dc_field(default_factory=lambda: defaultdict(list))
    fields: dict = dc_field(default_factory=lambda: defaultdict(Counter))
    load: Counter = dc_field(default_factory=Counter)
    as_position: Counter = dc_field(default_factory=Counter)

    def take(self, official_id: int, match: Match, position: str) -> None:
        self.busy[official_id].append((match.scheduled_start, match.scheduled_end))
        self.fields[official_id][match.field_id] += 1
        self.load[official_id] += 1
        self.as_position[(official_id, position)] += 1

    def is_free(self, official_id: int, match: Match) -> bool:
        return all(not (s < match.scheduled_end and e > match.scheduled_start) for s, e in self.busy[official_id])


def _peak(intervals: list[tuple]) -> int:
    """Mayor cantidad de posiciones simultáneas: [(inicio, fin, posiciones)]."""
    events = sorted([(s, 1, n) for s, _, n in intervals] + [(e, 0, -n) for _, e, n in intervals])
    current = peak = 0
    for _, _, n in events:  # a igual hora, primero terminan (0) y luego empiezan (1)
        current += n
        peak = max(peak, current)
    return peak


def _history(role: Role, tournament_id: int) -> Counter:
    """Partidos que lleva cada oficial en el torneo (para repartir también entre jornadas)."""
    counts = Counter()
    rows = Match.objects.filter(tournament_id=tournament_id, status__in=ACTIVE_STATUSES)
    for position in role.all_positions:
        for official_id in rows.exclude(**{f"{position}_id": None}).values_list(f"{position}_id", flat=True):
            counts[official_id] += 1
    return counts


def _plan_role(role: Role, targets: list[Match], day_matches: list[Match], history: Counter) -> tuple[dict, int]:
    """
    Devuelve ({partido: {posición: id_oficial}}, posiciones sin cubrir). Primero reparte a los oficiales libres
    entre las canchas para igualar la carga (cada cancha recibe al menos los que necesita a la vez); después, en
    cada cancha y por orden de hora, cada posición va al oficial libre con menos partidos en el día.
    """
    day = Day()
    work = Counter()  # posiciones por cubrir + ya cubiertas, por cancha (todo el día)
    intervals = defaultdict(list)
    for m in day_matches:
        for position in role.all_positions:
            official_id = getattr(m, f"{position}_id")
            if official_id:
                day.take(official_id, m, position)
        if m.field_id:
            count = len(role.positions(m))
            work[m.field_id] += count
            intervals[m.field_id].append((m.scheduled_start, m.scheduled_end, count))

    slots = [(m, p) for m in targets for p in role.positions(m) if not getattr(m, f"{p}_id")]
    open_by_field = Counter(m.field_id for m, _ in slots)
    fields = sorted(open_by_field)
    peak = {f: _peak(intervals[f]) for f in fields}

    # Oficiales ya ubicados hoy: quedan en la cancha donde más partidos tienen.
    members = {f: [] for f in fields}
    bound = set()
    for official_id, used in day.fields.items():
        bound.add(official_id)
        home = used.most_common(1)[0][0]
        if home in members:
            members[home].append(official_id)

    pool = role.model.objects.filter(is_active=True).exclude(pk__in=bound).values_list("pk", flat=True)
    added = Counter()
    for official_id in sorted(pool, key=lambda pk: (history[pk], pk)):
        candidates = [f for f in fields if added[f] < open_by_field[f]]
        if not candidates:
            break
        short = [f for f in candidates if len(members[f]) < peak[f]]
        best = max(short or candidates,
                   key=lambda f: (work[f] / len(members[f]) if members[f] else float("inf"), work[f], -f))
        members[best].append(official_id)
        added[best] += 1

    order = {p: i for i, p in enumerate(role.all_positions)}
    plan, missing = defaultdict(dict), 0
    for m, position in sorted(slots, key=lambda s: (s[0].scheduled_start, s[0].field_id, s[0].pk, order[s[1]])):
        free = [o for o in members.get(m.field_id, []) if day.is_free(o, m)]
        if not free:
            missing += 1
            continue
        chosen = min(free, key=lambda o: (day.load[o], day.as_position[(o, position)], history[o], o))
        day.take(chosen, m, position)
        plan[m][position] = chosen
    return plan, missing


@transaction.atomic
def auto_assign_officials(matchday: Matchday, roles: list[str], user) -> dict:
    """
    Llena las posiciones vacías (delegado y/o terna arbitral) de los partidos pendientes de una jornada enviada.
    `roles` ⊆ {"delegate", "referees"}. Avisa a cada oficial con el resumen de sus partidos.
    """
    matchday =Matchday.objects.select_for_update().get(pk=matchday.pk)
    if matchday.status != Matchday.Status.SUBMITTED:
        raise ValidationError("Los oficiales se asignan en jornadas enviadas (pendientes de confirmación).")
    related = ("tournament", "category", "field", "home__team", "away__team")
    targets = list(
        Match.objects.select_for_update(of=("self",)).filter(matchday=matchday, status=Match.Status.PENDING)
        .exclude(field=None).exclude(scheduled_start=None).select_related(*related)
        .prefetch_related("tournament__category_rules").order_by("scheduled_start", "pk")
    )
    target_ids = {m.pk for m in targets}
    others = list(
        Match.objects.filter(status__in=ACTIVE_STATUSES, scheduled_start__date=matchday.date)
        .exclude(pk__in=target_ids).exclude(scheduled_start=None).exclude(scheduled_end=None)
        .select_related("tournament", "category").prefetch_related("tournament__category_rules")
    )
    day_matches = targets + others

    result = {"assigned": 0, "missing": {}, "officials": {}, "over_target": {}}
    changed: dict[Match, dict] = defaultdict(dict)
    for key in roles:
        role = ROLES[key]
        plan, missing = _plan_role(role, targets, day_matches, _history(role, matchday.tournament_id))
        loads = Counter()
        for match, positions in plan.items():
            for position, official_id in positions.items():
                setattr(match, f"{position}_id", official_id)
                changed[match][position] = official_id
                loads[official_id] += 1
        # Carga total del día de los que recibieron partidos (incluye lo que ya tenían).
        day_load = Counter()
        for m in day_matches:
            for position in role.all_positions:
                official_id = getattr(m, f"{position}_id")
                if official_id in loads:
                    day_load[official_id] += 1
        result["assigned"] += sum(loads.values())
        result["missing"][key] = missing
        result["officials"][key] = len(loads)
        result["over_target"][key] = sum(1 for n in day_load.values() if n > DAILY_TARGET)

    if not changed:
        return result
    now = timezone.now()
    for match in changed:
        match.updated_at = now
    Match.objects.bulk_update(list(changed), [*REFEREE_FIELDS, "delegate", "updated_at"], batch_size=500)
    record("auto_assign_officials", matchday, user=user,
           changes={"partidos": {str(m.pk): positions for m, positions in changed.items()}})
    _notify_officials(matchday, changed)
    return result


def _notify_officials(matchday: Matchday, changed: dict) -> None:
    """Un aviso por oficial con todos sus partidos nuevos (cancha, hora y posición)."""
    by_official = defaultdict(list)
    for match, positions in changed.items():
        for position, official_id in positions.items():
            model = Delegate if position == "delegate" else Referee
            by_official[(model, official_id)].append((match, position))
    users = {}
    for model in (Delegate, Referee):
        ids = [o for m, o in by_official if m is model]
        users[model] = dict(model.objects.filter(pk__in=ids, user__is_active=True).values_list("pk", "user"))
    accounts = get_user_model().objects.in_bulk([u for d in users.values() for u in d.values()])
    for (model, official_id), items in by_official.items():
        account = accounts.get(users[model].get(official_id))
        if account is None:
            continue
        items.sort(key=lambda i: i[0].scheduled_start)
        lines = "; ".join(f"{timezone.localtime(m.scheduled_start):%H:%M} {m.field} · {m} ({POSITION_LABELS[p]})"
                          for m, p in items)
        notify([account], "Nueva asignación pendiente de confirmación",
               f"{matchday} ({matchday.tournament}) · {matchday.date:%d/%m/%Y}: {len(items)} partido(s). {lines}. "
               "Confirme o rechace su asistencia en cada partido.",
               level="warning", link="/app/mis-partidos")
