"""
Mesa técnica: registro en tiempo real de la cronología del partido.

Los eventos son asientos inalterables; los errores se corrigen con un evento de
anulación (con motivo) que conserva la evidencia del evento original.
"""
from dataclasses import dataclass, field

from django.core.exceptions import PermissionDenied, ValidationError
from django.db import transaction
from django.db.models import Max
from django.utils import timezone

from apps.audit.services import record
from apps.notifications.services import notify

from ..models import Lineup, Match, MatchEvent
from .parties import involved_users

T = MatchEvent.Type
LIVE_STATUSES = (Match.Status.CONFIRMED, Match.Status.IN_PROGRESS, Match.Status.FINISHED)
ANNULLABLE = MatchEvent.IN_PLAY_TYPES | {T.INCIDENT, T.NOTE}


@dataclass
class TeamState:
    goals: int = 0
    yellow: int = 0
    red: int = 0
    substitutions: int = 0
    arrived: bool = False
    documents_verified: bool = False
    on_field: set = field(default_factory=set)
    bench: set = field(default_factory=set)
    used: set = field(default_factory=set)  # jugadores que ya salieron (no pueden reingresar)
    sent_off: set = field(default_factory=set)
    yellows: dict = field(default_factory=dict)

    def as_dict(self):
        return {
            "goals": self.goals, "yellow": self.yellow, "red": self.red, "substitutions": self.substitutions,
            "arrived": self.arrived, "documents_verified": self.documents_verified,
            "on_field": sorted(self.on_field), "bench": sorted(self.bench), "sent_off": sorted(self.sent_off),
        }


def can_operate(match: Match, user) -> bool:
    if user.is_superuser or user.has_perm("competition.operate_any_match"):
        return True
    return (
        user.has_perm("competition.operate_match")
        and match.delegate_id is not None
        and match.delegate.user_id == user.pk
    )


def compute_state(match: Match) -> dict:
    events = list(match.events.order_by("sequence"))
    annulled = {e.annuls_id for e in events if e.type == T.ANNULMENT}
    valid = [e for e in events if e.type != T.ANNULMENT and e.id not in annulled]

    teams = {match.home_id: TeamState(), match.away_id: TeamState()}
    for lineup in Lineup.objects.filter(match=match).prefetch_related("players"):
        state = teams[lineup.team_id]
        for lp in lineup.players.all():
            (state.on_field if lp.is_starter else state.bench).add(lp.team_player_id)

    delegate_arrived = kicked_off = ended = False
    for e in valid:
        team = teams.get(e.team_id)
        if e.type == T.DELEGATE_ARRIVAL:
            delegate_arrived = True
        elif e.type == T.TEAM_ARRIVAL:
            team.arrived = True
        elif e.type == T.DOCUMENTS_VERIFIED:
            team.documents_verified = True
        elif e.type == T.KICKOFF:
            kicked_off = True
        elif e.type == T.MATCH_END:
            ended = True
        elif e.type in (T.GOAL, T.PENALTY_GOAL):
            team.goals += 1
        elif e.type == T.OWN_GOAL:
            other = match.away_id if e.team_id == match.home_id else match.home_id
            teams[other].goals += 1
        elif e.type == T.YELLOW_CARD:
            team.yellow += 1
            team.yellows[e.player_id] = team.yellows.get(e.player_id, 0) + 1
        elif e.type == T.RED_CARD:
            team.red += 1
            team.sent_off.add(e.player_id)
            team.on_field.discard(e.player_id)
            team.bench.discard(e.player_id)
        elif e.type == T.SUBSTITUTION:
            team.substitutions += 1
            team.on_field.discard(e.player_id)
            team.used.add(e.player_id)
            team.bench.discard(e.player_in_id)
            team.on_field.add(e.player_in_id)

    return {
        "delegate_arrived": delegate_arrived,
        "kicked_off": kicked_off,
        "ended": ended,
        "home_score": teams[match.home_id].goals,
        "away_score": teams[match.away_id].goals,
        "home": teams[match.home_id],
        "away": teams[match.away_id],
    }


def public_state(match: Match) -> dict:
    state = compute_state(match)
    return {
        "home_score": state["home_score"],
        "away_score": state["away_score"],
        "home": state["home"].as_dict(),
        "away": state["away"].as_dict(),
        "delegate_arrived": state["delegate_arrived"],
        "kicked_off": state["kicked_off"],
        "ended": state["ended"],
        "phase": match.phase,
        "current_period": match.current_period,
        "period_started_at": match.period_started_at,
        "minute": current_minute(match),
    }


def current_minute(match: Match) -> int | None:
    if match.phase != Match.Phase.PLAYING or not match.period_started_at:
        return None
    period_length = match.tournament.match_duration_minutes // max(match.tournament.periods, 1)
    elapsed = int((timezone.now() - match.period_started_at).total_seconds() // 60)
    return (match.current_period - 1) * period_length + elapsed + 1


def _require(condition: bool, message: str):
    if not condition:
        raise ValidationError(message)


def _validate(match: Match, state: dict, data: dict, post_match: bool):
    etype = data["type"]
    team_id = data.get("team_id")
    team_state = state["home"] if team_id == match.home_id else state["away"] if team_id == match.away_id else None
    player_id = data.get("player_id")
    player_in_id = data.get("player_in_id")

    if etype != T.DELEGATE_ARRIVAL:
        _require(state["delegate_arrived"], "Primero debe reportar la llegada del delegado.")
    if etype in (T.TEAM_ARRIVAL, T.DOCUMENTS_VERIFIED) or etype in MatchEvent.IN_PLAY_TYPES:
        _require(team_state is not None, "Debe indicar un equipo del partido.")

    if etype == T.DELEGATE_ARRIVAL:
        _require(not state["delegate_arrived"], "La llegada del delegado ya fue reportada.")
    elif etype == T.TEAM_ARRIVAL:
        _require(not team_state.arrived, "La llegada de este equipo ya fue reportada.")
    elif etype == T.DOCUMENTS_VERIFIED:
        _require(team_state.arrived, "Debe reportar la llegada del equipo antes de revisar documentos.")
        _require(not team_state.documents_verified, "La documentación de este equipo ya fue verificada.")
        _require(Lineup.objects.filter(match=match, team_id=team_id).exists(),
                 "El equipo no cargó su alineación en la aplicación.")
    elif etype == T.KICKOFF:
        _require(not state["kicked_off"], "El partido ya inició.")
        _require(state["home"].documents_verified and state["away"].documents_verified,
                 "Ambos equipos deben tener la documentación verificada antes del inicio.")
    elif etype == T.PERIOD_END:
        _require(match.phase == Match.Phase.PLAYING, "No hay un tiempo en juego.")
    elif etype == T.PERIOD_START:
        _require(match.phase == Match.Phase.BREAK, "El partido no está en descanso.")
        _require(match.current_period < match.tournament.periods, "Ya se jugaron todos los tiempos.")
    elif etype == T.MATCH_END:
        _require(state["kicked_off"] and not state["ended"], "El partido no está en juego.")
    elif etype in MatchEvent.IN_PLAY_TYPES:
        if post_match:
            _require(bool(data.get("notes", "").strip()), "Las correcciones posteriores al final requieren motivo.")
        else:
            _require(match.phase in (Match.Phase.PLAYING, Match.Phase.BREAK), "El partido no está en juego.")
            if etype != T.YELLOW_CARD and etype != T.RED_CARD:
                _require(match.phase == Match.Phase.PLAYING, "El balón no está en juego (descanso).")
        lineup_ids = team_state.on_field | team_state.bench | team_state.used | team_state.sent_off
        _require(player_id in lineup_ids, "El jugador no está en la alineación del equipo.")
        _require(player_id not in team_state.sent_off, "El jugador fue expulsado.")
        if etype in MatchEvent.GOAL_TYPES and not post_match:
            _require(player_id in team_state.on_field, "El jugador no está en el campo.")
        if etype == T.SUBSTITUTION:
            _require(player_id in team_state.on_field, "El jugador que sale no está en el campo.")
            _require(player_in_id in team_state.bench, "El jugador que entra no está en el banco.")
            limit = match.tournament.max_substitutions
            _require(limit is None or team_state.substitutions < limit, f"Se alcanzó el máximo de {limit} cambios.")
    elif etype in (T.INCIDENT, T.NOTE):
        _require(bool(data.get("notes", "").strip()), "Debe describir la incidencia.")
    elif etype == T.ANNULMENT:
        target = data.get("annuls")
        _require(target is not None and target.match_id == match.id, "Debe indicar el evento a anular.")
        _require(target.type in ANNULLABLE, "Este tipo de evento no puede anularse.")
        _require(not MatchEvent.objects.filter(annuls=target).exists(), "El evento ya fue anulado.")
        _require(len(data.get("notes", "").strip()) >= 5, "Debe indicar el motivo de la anulación.")


def _create(match: Match, user, **kwargs) -> MatchEvent:
    sequence = (match.events.aggregate(m=Max("sequence"))["m"] or 0) + 1
    etype = kwargs["type"]
    return MatchEvent.objects.create(
        match=match, sequence=sequence, recorded_by=user, is_public=etype in MatchEvent.PUBLIC_TYPES,
        period=match.current_period, **kwargs,
    )


@transaction.atomic
def record_event(match: Match, user, data: dict) -> list[MatchEvent]:
    match = Match.objects.select_for_update().select_related("tournament", "delegate").get(pk=match.pk)
    if not can_operate(match, user):
        raise PermissionDenied("Solo el delegado asignado puede operar la mesa técnica de este partido.")
    if match.status not in LIVE_STATUSES:
        raise ValidationError("El partido no está habilitado para la mesa técnica.")
    post_match = match.status == Match.Status.FINISHED
    if post_match and data["type"] not in (MatchEvent.IN_PLAY_TYPES | {T.ANNULMENT, T.INCIDENT, T.NOTE}):
        raise ValidationError("El partido terminó; solo se admiten correcciones, anulaciones o notas.")

    state = compute_state(match)
    _validate(match, state, data, post_match)
    etype = data["type"]
    minute = data.get("minute") or current_minute(match)
    event = _create(
        match, user, type=etype, minute=minute, team_id=data.get("team_id"), player_id=data.get("player_id"),
        player_in_id=data.get("player_in_id"), annuls=data.get("annuls"), notes=data.get("notes", "").strip(),
    )
    created = [event]
    now = timezone.now()

    if etype == T.DOCUMENTS_VERIFIED:
        Lineup.objects.filter(match=match, team_id=data["team_id"]).update(
            status=Lineup.Status.VERIFIED, verified_by=user, verified_at=now
        )
    elif etype == T.KICKOFF:
        match.status, match.phase, match.current_period, match.period_started_at = (
            Match.Status.IN_PROGRESS, Match.Phase.PLAYING, 1, now)
    elif etype == T.PERIOD_END:
        match.phase = Match.Phase.BREAK
    elif etype == T.PERIOD_START:
        match.phase, match.current_period, match.period_started_at = (
            Match.Phase.PLAYING, match.current_period + 1, now)
    elif etype == T.MATCH_END:
        match.status, match.phase = Match.Status.FINISHED, Match.Phase.ENDED
    elif etype == T.YELLOW_CARD:
        team_state = state["home"] if data["team_id"] == match.home_id else state["away"]
        if team_state.yellows.get(data["player_id"], 0) >= 1:
            created.append(_create(match, user, type=T.RED_CARD, minute=minute, team_id=data["team_id"],
                                   player_id=data["player_id"], notes="Expulsión por doble amarilla"))
    match.save()
    record("match_event", match, user=user, changes={"tipo": etype, "secuencia": event.sequence})

    if etype == T.MATCH_END:
        final = compute_state(match)
        notify(involved_users(match), "Partido finalizado",
               f"{match} terminó {final['home_score']}-{final['away_score']}. Delegado y árbitro deben enviar "
               "sus informes.", link=f"/app/partidos/{match.id}")
    return created
