"""Servicios de torneos que no son CRUD simple."""
from django.core.exceptions import ValidationError
from django.db import transaction

from apps.audit.services import record

from .models import CategoryRules, Group, TeamPlayer, Tournament, TournamentTeam


@transaction.atomic
def delete_draft_tournament(tournament: Tournament, user) -> None:
    """
    Borra definitivamente un torneo en borrador con todo lo que cuelga de él (jornadas, partidos,
    inscripciones, nóminas, grupos y ajustes de reglas). Una vez que algo salió de borrador ya no se borra.
    """
    from apps.competition.models import Match, Matchday

    tournament = Tournament.objects.select_for_update().get(pk=tournament.pk)
    if tournament.status != Tournament.Status.DRAFT:
        raise ValidationError("Solo se eliminan torneos en borrador.")
    if Match.objects.filter(tournament=tournament).exclude(status=Match.Status.DRAFT).exists() or \
            Matchday.objects.filter(tournament=tournament).exclude(status=Matchday.Status.DRAFT).exists():
        raise ValidationError("El torneo ya tiene jornadas o partidos enviados: no se puede eliminar.")
    record("delete", tournament, user=user, changes={"torneo": tournament.name})
    # QuerySet.delete() no pasa por el bloqueo de borrado de cada registro (BaseEntity.delete).
    Match.objects.filter(tournament=tournament).delete()
    Matchday.objects.filter(tournament=tournament).delete()
    TeamPlayer.objects.filter(tournament=tournament).delete()
    TournamentTeam.objects.filter(tournament=tournament).delete()
    Group.objects.filter(tournament=tournament).delete()
    CategoryRules.objects.filter(tournament=tournament).delete()
    Tournament.objects.filter(pk=tournament.pk).delete()
