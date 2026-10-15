"""Generación de fixture (todos contra todos) con el método del círculo."""
from django.core.exceptions import ValidationError
from django.db import transaction

from apps.audit.services import record
from apps.tournaments.models import Tournament, TournamentTeam

from ..models import Match, Stage


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
                     double: bool | None = None, replace: bool = False) -> list[Match]:
    registrations = TournamentTeam.objects.filter(tournament=tournament, category_id=category_id, is_active=True)
    if group_id:
        registrations = registrations.filter(group_id=group_id)
    ids = list(registrations.order_by("id").values_list("id", flat=True))
    if len(ids) < 2:
        raise ValidationError("Se requieren al menos 2 equipos inscritos para generar el fixture.")
    existing = Match.objects.filter(tournament=tournament, category_id=category_id, group_id=group_id,
                                    stage=Stage.REGULAR)
    if existing.exists():
        if not replace:
            raise ValidationError("Ya existe un fixture para esta categoría/grupo. Marque «Reemplazar» para generarlo de nuevo.")
        if existing.exclude(status=Match.Status.DRAFT).exists():
            raise ValidationError("El fixture tiene partidos ya enviados: no se puede reemplazar.")
        record("delete_fixture", tournament, user=user,
               changes={"categoria": category_id, "grupo": group_id, "partidos": existing.count()})
        existing.delete()
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


@transaction.atomic
def delete_draft_matches(tournament: Tournament, ids: list[int], user) -> dict:
    """
    Borra varios partidos de la fase regular que siguen en borrador. Los enviados se modifican con ajustes y
    los de la eliminación directa se gestionan desde su llave, así que se omiten.
    """
    selected = Match.objects.filter(tournament=tournament, pk__in=ids)
    deletable = selected.filter(status=Match.Status.DRAFT, stage=Stage.REGULAR)
    labels = [str(m) for m in deletable.select_related("home__team", "away__team")]
    skipped = selected.count() - len(labels)
    if labels:
        record("delete_matches", tournament, user=user, changes={"partidos": labels})
        deletable.delete()
    return {"deleted": len(labels), "skipped": skipped}
