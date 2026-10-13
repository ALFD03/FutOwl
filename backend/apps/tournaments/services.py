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


def register_teams(tournament: Tournament, entries: list[dict], user) -> dict:
    """
    Inscripción masiva: `entries` = [{"team": id, "categories": [ids]}]. Cada inscripción se guarda por
    separado (una que falle no frena a las demás) y una inscripción desactivada se reactiva en vez de duplicarse.
    Devuelve cuántas se crearon y los errores por equipo/categoría.
    """
    from apps.registry.models import Category, Team

    team_ids = {e["team"] for e in entries}
    teams = Team.objects.in_bulk(team_ids)
    categories = Category.objects.in_bulk({c for e in entries for c in e["categories"]})
    existing = {(r.team_id, r.category_id): r for r in TournamentTeam.objects.filter(
        tournament=tournament, team_id__in=team_ids)}
    created, errors = 0, []
    for entry in entries:
        team = teams.get(entry["team"])
        for category_id in dict.fromkeys(entry["categories"]):
            category = categories.get(category_id)
            label = f"{team.name if team else entry['team']} · {category.name if category else category_id}"
            try:
                if team is None or category is None:
                    raise ValidationError("El equipo o la categoría no existen.")
                current = existing.get((team.pk, category.pk))
                if current is not None and current.is_active:
                    raise ValidationError("Ya está inscrito en esta categoría.")
                with transaction.atomic():
                    if current is not None:
                        current.is_active = True
                        current.full_clean()
                        current.save(update_fields=["is_active", "updated_at"])
                        record("activate", current, user=user, changes={"is_active": True})
                    else:
                        registration = TournamentTeam(tournament=tournament, team=team, category=category,
                                                      created_by=user)
                        registration.full_clean()
                        registration.save()
                created += 1
            except ValidationError as exc:
                errors.append({"team": entry["team"], "category": category_id, "label": label,
                               "message": " ".join(exc.messages)})
    return {"created": created, "errors": errors}
