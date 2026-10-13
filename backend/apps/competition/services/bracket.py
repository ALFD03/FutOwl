"""
Fase de grupos y eliminación directa.

- Sorteo de grupos: reparte al azar los equipos inscritos de una categoría en N grupos lo más parejos posible.
- Llave: según la cantidad de grupos y equipos, se elige la ronda inicial (32avos … final); se calcula cuántos
  clasifican por grupo y cuántos cupos completan los mejores del siguiente puesto. Se crean todos los partidos
  de la llave con nombres representativos («1º Grupo A», «Ganador Octavos 3») para poder programarlos.
- Proyección: muestra quién entraría con las posiciones actuales.
- Llenado: con la fase de grupos terminada, se asignan los equipos reales a la primera ronda.
- Avance: al cerrar un partido de la llave, el ganador pasa solo al partido siguiente.
"""
import random
from string import ascii_uppercase

from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone

from apps.audit.services import record
from apps.tournaments.models import Group, Tournament, TournamentTeam

from ..models import KNOCKOUT_STAGES, Bracket, Match, Stage
from .fixtures import generate_fixture
from .standings import standings

STAGE_ORDER = [stage for stage, _ in KNOCKOUT_STAGES]
STAGE_MATCHES = dict(KNOCKOUT_STAGES)
FINISHED = [Match.Status.CLOSED, Match.Status.SUSPENDED]


def _uses_groups(tournament: Tournament) -> bool:
    return tournament.modality in (Tournament.Modality.GROUPS, Tournament.Modality.GROUPS_KNOCKOUT)


def _registrations(tournament: Tournament, category_id: int):
    return TournamentTeam.objects.filter(tournament=tournament, category_id=category_id, is_active=True)


def _groups(tournament: Tournament, category_id: int) -> list[Group]:
    return list(Group.objects.filter(tournament=tournament, category_id=category_id, is_active=True).order_by("name"))


def _group_names(count: int) -> list[str]:
    letters = list(ascii_uppercase)
    return [f"Grupo {letters[i] if i < 26 else letters[i // 26 - 1] + letters[i % 26]}" for i in range(count)]


def _knockout_matches(tournament: Tournament, category_id: int):
    return Match.objects.filter(tournament=tournament, category_id=category_id).exclude(stage=Stage.REGULAR)


def _assert_knockout_untouched(tournament: Tournament, category_id: int) -> None:
    if _knockout_matches(tournament, category_id).exclude(status=Match.Status.DRAFT).exists():
        raise ValidationError("La eliminación directa ya tiene partidos enviados: no se puede rehacer.")


def _reset_knockout(tournament: Tournament, category_id: int) -> None:
    _assert_knockout_untouched(tournament, category_id)
    _knockout_matches(tournament, category_id).delete()
    Bracket.objects.filter(tournament=tournament, category_id=category_id).delete()


# ---------------------------------------------------------------- sorteo de grupos
@transaction.atomic
def draw_groups(tournament: Tournament, category_id: int, groups_count: int, user) -> list[Group]:
    """Sorteo aleatorio y equitativo (tamaños que difieren a lo sumo en uno). Rehace grupos y partidos en borrador."""
    if not _uses_groups(tournament):
        raise ValidationError("La modalidad del torneo no usa fase de grupos.")
    regs = list(_registrations(tournament, category_id))
    if groups_count < 1:
        raise ValidationError({"groups": "Indique al menos un grupo."})
    if len(regs) < groups_count * 2:
        raise ValidationError({"groups": f"Con {len(regs)} equipos caben como máximo {len(regs) // 2} grupos "
                                         "(cada grupo necesita al menos 2 equipos)."})
    regular = Match.objects.filter(tournament=tournament, category_id=category_id, stage=Stage.REGULAR)
    if regular.exclude(status=Match.Status.DRAFT).exists():
        raise ValidationError("La fase de grupos ya tiene partidos enviados: no se puede volver a sortear.")
    _reset_knockout(tournament, category_id)
    regular.delete()
    TournamentTeam.objects.filter(pk__in=[r.pk for r in regs]).update(group=None)
    Group.objects.filter(tournament=tournament, category_id=category_id).delete()

    groups = [Group.objects.create(tournament=tournament, category_id=category_id, name=name, created_by=user)
              for name in _group_names(groups_count)]
    random.shuffle(regs)
    for index, reg in enumerate(regs):
        reg.group = groups[index % groups_count]
    TournamentTeam.objects.bulk_update(regs, ["group"])
    record("draw_groups", tournament, user=user,
           changes={"categoria": category_id, "grupos": groups_count, "equipos": len(regs)})
    return groups


@transaction.atomic
def generate_group_fixtures(tournament: Tournament, category_id: int, user) -> int:
    """Genera de una vez el fixture (todos contra todos) de cada grupo que aún no lo tenga."""
    created = 0
    for group in _groups(tournament, category_id):
        if not Match.objects.filter(tournament=tournament, category_id=category_id, group=group,
                                    stage=Stage.REGULAR).exists():
            created += len(generate_fixture(tournament, category_id, user, group_id=group.id))
    if not created:
        raise ValidationError("Todos los grupos ya tienen su fixture (o no hay grupos).")
    return created


# ---------------------------------------------------------------- opciones de la llave
def bracket_options(tournament: Tournament, category_id: int) -> list[dict]:
    """Rondas iniciales posibles con sus clasificados por grupo y mejores siguientes."""
    teams = _registrations(tournament, category_id).count()
    if tournament.modality == Tournament.Modality.KNOCKOUT:
        if teams < 2:
            return []
        size = 1 << (teams - 1).bit_length()  # siguiente potencia de 2
        stage = next((s for s, m in KNOCKOUT_STAGES if m * 2 == size), None)
        return [{"stage": stage, "label": Stage(stage).label, "slots": size, "per_group": 0, "best_extra": 0,
                 "byes": size - teams}] if stage else []
    if tournament.modality != Tournament.Modality.GROUPS_KNOCKOUT:
        return []
    groups = _groups(tournament, category_id)
    if not groups:
        return []
    sizes = [g.teams.filter(is_active=True).count() for g in groups]
    options = []
    for stage, matches in KNOCKOUT_STAGES:
        slots = matches * 2
        if slots > teams:
            continue
        per_group, extra = divmod(slots, len(groups))
        if extra and per_group + 1 > min(sizes) or not extra and per_group > min(sizes):
            continue
        options.append({"stage": stage, "label": Stage(stage).label, "slots": slots, "per_group": per_group,
                        "best_extra": extra, "byes": 0})
    return options


def _bracket_order(size: int) -> list[int]:
    """Orden de siembra en la llave: el 1 y el 2 solo pueden cruzarse en la final."""
    order = [1, 2]
    while len(order) < size:
        doubled = len(order) * 2
        order = [x for seed in order for x in (seed, doubled + 1 - seed)]
    return order


def _seed_label(slot: dict, groups: dict[int, str]) -> str:
    if slot["kind"] == "group":
        return f"{slot['place']}º {groups[slot['group']]}"
    if slot["kind"] == "best":
        return f"Mejor {slot['place']}º ({slot['rank']})"
    return ""


def _avoid_same_group(pairs: list[list[dict]]) -> None:
    """Evita que dos equipos del mismo grupo se crucen en la primera ronda (intercambia visitantes)."""
    def clash(a, b):
        return bool(a and b) and a["kind"] == b["kind"] == "group" and a["group"] == b["group"]

    for i, (home, away) in enumerate(pairs):
        if not clash(home, away):
            continue
        for j, other in enumerate(pairs):
            if j != i and not clash(home, other[1]) and not clash(other[0], away):
                pairs[i][1], pairs[j][1] = other[1], away
                break


@transaction.atomic
def create_bracket(tournament: Tournament, category_id: int, start_stage: str, user) -> Bracket:
    """Crea la llave y todos sus partidos (en borrador) desde la ronda elegida hasta la final."""
    option = next((o for o in bracket_options(tournament, category_id) if o["stage"] == start_stage), None)
    if option is None:
        raise ValidationError({"start_stage": "Esa ronda inicial no es posible con los grupos y equipos actuales."})
    _reset_knockout(tournament, category_id)
    groups = {g.id: g.name for g in _groups(tournament, category_id)}
    size = option["slots"]

    if tournament.modality == Tournament.Modality.KNOCKOUT:
        regs = list(_registrations(tournament, category_id))
        random.shuffle(regs)  # sorteo de la llave
        seeds = [{"kind": "team", "team": r.id} for r in regs] + [None] * option["byes"]
    else:
        seeds = [{"kind": "group", "group": gid, "place": place}
                 for place in range(1, option["per_group"] + 1) for gid in groups]
        seeds += [{"kind": "best", "place": option["per_group"] + 1, "rank": k}
                  for k in range(1, option["best_extra"] + 1)]

    order = _bracket_order(size)
    pairs = [[seeds[order[i] - 1], seeds[order[i + 1] - 1]] for i in range(0, size, 2)]
    _avoid_same_group(pairs)

    bracket = Bracket.objects.create(tournament=tournament, category_id=category_id, start_stage=start_stage,
                                     per_group=option["per_group"], best_extra=option["best_extra"], created_by=user)
    first = STAGE_ORDER.index(start_stage)
    stages = STAGE_ORDER[first:]
    built: dict[tuple[str, int], Match] = {}
    for index, stage in enumerate(stages):
        for position in range(1, STAGE_MATCHES[stage] + 1):
            match = Match(tournament=tournament, category_id=category_id, stage=stage, bracket_position=position,
                          round_number=first + index + 1, created_by=user)
            if index:
                previous = Stage(stages[index - 1]).label
                match.home_source = f"Ganador {previous} {position * 2 - 1}"
                match.away_source = f"Ganador {previous} {position * 2}"
            built[(stage, position)] = match

    slots, skipped = [], []
    for position, (home, away) in enumerate(pairs, start=1):
        match = built[(start_stage, position)]
        if None in (home, away):  # pase directo: el equipo pasa a la siguiente ronda sin jugar
            team = home or away
            skipped.append(match)
            _place(built, start_stage, position, team["team"], "Pase directo")
            continue
        for side, slot in (("home", home), ("away", away)):
            if slot["kind"] == "team":
                setattr(match, f"{side}_id", slot["team"])
            else:
                setattr(match, f"{side}_source", _seed_label(slot, groups))
            slots.append({**slot, "position": position, "side": side})
    for match in built.values():
        if match not in skipped:
            match.save()
    bracket.slots = slots
    bracket.save(update_fields=["slots"])
    record("create_bracket", tournament, user=user, changes={"categoria": category_id, "ronda": start_stage})
    return bracket


def _place(built, stage: str, position: int, team_id: int, source: str) -> None:
    following = STAGE_ORDER.index(stage) + 1
    if following >= len(STAGE_ORDER):
        return
    target = built.get((STAGE_ORDER[following], (position + 1) // 2))
    if target is None:
        return
    side = "home" if position % 2 else "away"
    setattr(target, f"{side}_id", team_id)
    setattr(target, f"{side}_source", source)


# ---------------------------------------------------------------- proyección y llenado
def _qualifiers(bracket: Bracket, live: bool) -> dict:
    """Equipos (id de inscripción) que ocupan cada cupo según las posiciones actuales o finales."""
    tables = {g.id: standings(bracket.tournament, bracket.category_id, g.id, include_live=live)
              for g in _groups(bracket.tournament, bracket.category_id)}
    resolved = {}
    best_place = bracket.per_group + 1
    candidates = [rows[best_place - 1] | {"group": gid} for gid, rows in tables.items() if len(rows) >= best_place]
    candidates.sort(key=lambda r: (-r["points"], -r["gd"], -r["gf"], r["team"]))
    for slot in bracket.slots:
        key = (slot["position"], slot["side"])
        if slot["kind"] == "group":
            rows = tables.get(slot["group"], [])
            resolved[key] = rows[slot["place"] - 1] if len(rows) >= slot["place"] else None
        elif slot["kind"] == "best":
            resolved[key] = candidates[slot["rank"] - 1] if len(candidates) >= slot["rank"] else None
    return resolved


def group_stage_finished(tournament: Tournament, category_id: int) -> bool:
    regular = Match.objects.filter(tournament=tournament, category_id=category_id, stage=Stage.REGULAR)
    return regular.exists() and not regular.exclude(status__in=FINISHED).exists()


@transaction.atomic
def fill_bracket(tournament: Tournament, category_id: int, user) -> Bracket:
    """Con la fase de grupos terminada, coloca a los clasificados reales en la primera ronda."""
    bracket = Bracket.objects.select_for_update().filter(tournament=tournament, category_id=category_id).first()
    if bracket is None:
        raise ValidationError("Primero configure la eliminación directa.")
    if tournament.modality != Tournament.Modality.GROUPS_KNOCKOUT:
        raise ValidationError("Esta llave no depende de una fase de grupos.")
    if not group_stage_finished(tournament, category_id):
        raise ValidationError("La fase de grupos no terminó: todos sus partidos deben estar cerrados o suspendidos.")
    resolved = _qualifiers(bracket, live=False)
    first = {m.bracket_position: m for m in _knockout_matches(tournament, category_id).filter(stage=bracket.start_stage)}
    # Un «mejor siguiente» no debe cruzarse con alguien de su propio grupo: se intercambia con otro cupo de mejores.
    best_keys = [(s["position"], s["side"]) for s in bracket.slots if s["kind"] == "best"]
    group_of = {key: row["group"] if row and "group" in row else None for key, row in resolved.items()}
    slot_group = {(s["position"], s["side"]): s.get("group") for s in bracket.slots if s["kind"] == "group"}

    def rival_group(key):
        position, side = key
        return slot_group.get((position, "away" if side == "home" else "home"))

    for key in best_keys:
        if group_of.get(key) and group_of[key] == rival_group(key):
            for other in best_keys:
                if other != key and group_of.get(other) != rival_group(key) and group_of[key] != rival_group(other):
                    resolved[key], resolved[other] = resolved[other], resolved[key]
                    group_of[key], group_of[other] = group_of[other], group_of[key]
                    break

    for (position, side), row in resolved.items():
        match = first.get(position)
        if match is None or row is None:
            continue
        if match.status != Match.Status.DRAFT:
            raise ValidationError(f"El partido {match} ya fue enviado: no se puede cambiar su equipo.")
        setattr(match, f"{side}_id", row["team_id"])
        match.save(update_fields=[f"{side}", "updated_at"])
    bracket.filled_at = timezone.now()
    bracket.save(update_fields=["filled_at", "updated_at"])
    record("fill_bracket", tournament, user=user, changes={"categoria": category_id})
    return bracket


def advance_winner(match: Match) -> None:
    """Pasa el ganador del partido de llave al partido siguiente (si aún no se jugó)."""
    if not match.is_knockout or not match.winner_id or match.stage == Stage.FINAL:
        return
    following = STAGE_ORDER[STAGE_ORDER.index(match.stage) + 1]
    target = Match.objects.filter(tournament=match.tournament, category=match.category, stage=following,
                                  bracket_position=(match.bracket_position + 1) // 2).first()
    if target is None or target.status not in (Match.Status.DRAFT, Match.Status.PENDING):
        return
    side = "home" if match.bracket_position % 2 else "away"
    setattr(target, f"{side}_id", match.winner_id)
    target.save(update_fields=[side, "updated_at"])


# ---------------------------------------------------------------- vista de la llave
def _team(reg: TournamentTeam | None) -> dict | None:
    if reg is None:
        return None
    return {"id": reg.id, "name": reg.team.name, "logo": reg.team.logo.url if reg.team.logo else None}


def bracket_view(tournament: Tournament, category_id: int) -> dict:
    bracket = Bracket.objects.filter(tournament=tournament, category_id=category_id).first()
    projected = _qualifiers(bracket, live=True) if bracket and bracket.slots and not bracket.filled_at else {}
    matches = (_knockout_matches(tournament, category_id)
               .select_related("home__team", "away__team", "winner__team", "field", "matchday")
               .order_by("round_number", "bracket_position"))
    stages: dict[str, list] = {}
    for m in matches:
        sides = {}
        for side in ("home", "away"):
            reg = getattr(m, side)
            row = projected.get((m.bracket_position, side)) if m.stage == (bracket.start_stage if bracket else None) else None
            sides[side] = {
                "team": _team(reg),
                "source": getattr(m, f"{side}_source"),
                "projected": None if reg or not row else {"id": row["team_id"], "name": row["team"], "logo": row["logo"],
                                                          "points": row["points"]},
            }
        stages.setdefault(m.stage, []).append({
            "id": m.id, "position": m.bracket_position, "status": m.status, "status_display": m.get_status_display(),
            "home": sides["home"], "away": sides["away"], "home_score": m.home_score, "away_score": m.away_score,
            "winner": m.winner_id, "scheduled_start": m.scheduled_start, "field_name": m.field.name if m.field else None,
            "matchday_label": str(m.matchday) if m.matchday else None,
        })
    return {
        "modality": tournament.modality,
        "bracket": {"start_stage": bracket.start_stage, "per_group": bracket.per_group,
                    "best_extra": bracket.best_extra, "filled": bool(bracket.filled_at)} if bracket else None,
        "options": bracket_options(tournament, category_id),
        "group_stage_finished": group_stage_finished(tournament, category_id),
        "stages": [{"stage": s, "label": Stage(s).label, "matches": stages[s]} for s in STAGE_ORDER if s in stages],
    }
