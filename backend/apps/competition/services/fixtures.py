"""Generación de fixture (todos contra todos) con el método del círculo."""
from django.core.exceptions import ValidationError
from django.db import transaction

from apps.audit.services import record
from apps.tournaments.models import Tournament, TournamentTeam

from ..models import Match


def round_robin(team_ids: list[int], double: bool = False) -> list[list[tuple[int, int]]]:
    teams = list(team_ids)
    if len(teams) % 2:
        teams.append(None)  # descanso
    n = len(teams)
    rounds = []
    for r in range(n - 1):
        pairs = []
        for i in range(n // 2):
            home, away = teams[i], teams[n - 1 - i]
            if home is None or away is None:
                continue
            pairs.append((home, away) if r % 2 == 0 else (away, home))
        rounds.append(pairs)
        teams = [teams[0], teams[-1], *teams[1:-1]]
    if double:
        rounds += [[(a, h) for h, a in pairs] for pairs in rounds]
    return rounds


@transaction.atomic
def generate_fixture(tournament: Tournament, category_id: int, user, *, group_id: int | None = None,
                     double: bool | None = None) -> list[Match]:
    registrations = TournamentTeam.objects.filter(tournament=tournament, category_id=category_id, is_active=True)
    if group_id:
        registrations = registrations.filter(group_id=group_id)
    ids = list(registrations.order_by("id").values_list("id", flat=True))
    if len(ids) < 2:
        raise ValidationError("Se requieren al menos 2 equipos inscritos para generar el fixture.")
    existing = Match.objects.filter(tournament=tournament, category_id=category_id, group_id=group_id)
    if existing.exists():
        raise ValidationError("Ya existe un fixture para esta categoría/grupo.")
    double = tournament.modality == Tournament.Modality.LEAGUE_DOUBLE if double is None else double
    matches = []
    for number, pairs in enumerate(round_robin(ids, double), start=1):
        for home, away in pairs:
            matches.append(Match(tournament=tournament, category_id=category_id, group_id=group_id,
                                 round_number=number, home_id=home, away_id=away, created_by=user))
    created = Match.objects.bulk_create(matches)
    record("generate_fixture", tournament, user=user,
           changes={"categoria": category_id, "grupo": group_id, "partidos": len(created)})
    return created
