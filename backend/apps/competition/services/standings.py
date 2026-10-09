"""Tabla de posiciones y estadísticas."""
from django.db.models import Count, Q

from apps.tournaments.models import Tournament, TournamentTeam

from ..models import Match, MatchEvent
from .live import compute_state

T = MatchEvent.Type


def standings(tournament: Tournament, category_id: int, group_id: int | None = None,
              include_live: bool = False) -> list[dict]:
    teams = TournamentTeam.objects.filter(tournament=tournament, category_id=category_id, is_active=True)
    if group_id:
        teams = teams.filter(group_id=group_id)
    table = {
        t.id: {"team_id": t.id, "team": t.team.name, "logo": t.team.logo.url if t.team.logo else None,
               "played": 0, "won": 0, "drawn": 0, "lost": 0, "gf": 0, "ga": 0, "gd": 0, "points": 0,
               "form": []}
        for t in teams.select_related("team")
    }
    statuses = [Match.Status.CLOSED]
    if include_live:
        statuses += [Match.Status.IN_PROGRESS, Match.Status.FINISHED]
    matches = Match.objects.filter(tournament=tournament, category_id=category_id, status__in=statuses)
    if group_id:
        matches = matches.filter(group_id=group_id)
    for match in matches.order_by("scheduled_start"):
        if match.status == Match.Status.CLOSED:
            hs, as_ = match.home_score, match.away_score
        else:
            state = compute_state(match)
            hs, as_ = state["home_score"], state["away_score"]
        for team_id, gf, ga in ((match.home_id, hs, as_), (match.away_id, as_, hs)):
            row = table.get(team_id)
            if row is None:
                continue
            row["played"] += 1
            row["gf"] += gf
            row["ga"] += ga
            if gf > ga:
                row["won"] += 1
                row["points"] += tournament.points_win
                row["form"].append("G")
            elif gf == ga:
                row["drawn"] += 1
                row["points"] += tournament.points_draw
                row["form"].append("E")
            else:
                row["lost"] += 1
                row["points"] += tournament.points_loss
                row["form"].append("P")
    for row in table.values():
        row["gd"] = row["gf"] - row["ga"]
        row["form"] = row["form"][-5:]
    ordered = sorted(table.values(), key=lambda r: (-r["points"], -r["gd"], -r["gf"], r["team"]))
    for position, row in enumerate(ordered, start=1):
        row["position"] = position
    return ordered


def player_stats(tournament: Tournament, category_id: int | None = None, limit: int = 20) -> dict:
    events = MatchEvent.objects.filter(
        match__tournament=tournament, annulled_by__isnull=True, player__isnull=False,
        match__status__in=[Match.Status.IN_PROGRESS, Match.Status.FINISHED, Match.Status.CLOSED],
    ).exclude(type=T.ANNULMENT)
    if category_id:
        events = events.filter(match__category_id=category_id)
    rows = (
        events.values("player", "player__player__first_name", "player__player__last_name", "player__registration__team__name")
        .annotate(
            goals=Count("id", filter=Q(type__in=[T.GOAL, T.PENALTY_GOAL])),
            yellow=Count("id", filter=Q(type=T.YELLOW_CARD)),
            red=Count("id", filter=Q(type=T.RED_CARD)),
        )
    )
    data = [
        {"team_player": r["player"], "name": f"{r['player__player__first_name']} {r['player__player__last_name']}",
         "team": r["player__registration__team__name"], "goals": r["goals"], "yellow": r["yellow"], "red": r["red"]}
        for r in rows
    ]
    scorers = sorted([d for d in data if d["goals"]], key=lambda d: (-d["goals"], d["name"]))[:limit]
    discipline = sorted([d for d in data if d["yellow"] or d["red"]],
                        key=lambda d: (-d["red"], -d["yellow"], d["name"]))[:limit]
    return {"scorers": scorers, "discipline": discipline}
