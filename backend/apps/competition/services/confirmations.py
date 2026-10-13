"""Confirmación/rechazo de asistencia de delegados, árbitros y equipos."""
from django.core.exceptions import PermissionDenied, ValidationError
from django.db import transaction
from django.utils import timezone

from apps.audit.services import record
from apps.notifications.services import notify, notify_permission

from ..models import Match, MatchConfirmation, Matchday, Party, ReviewCase
from .parties import involved_users, officials_confirmed, parties_for_user, party_status, party_user_ids


@transaction.atomic
def respond(match: Match, user, party: str, response: str, reason: str = "") -> MatchConfirmation:
    match = Match.objects.select_for_update().get(pk=match.pk)
    if match.status not in (Match.Status.PENDING, Match.Status.CONFIRMED):
        raise ValidationError("El partido no está esperando confirmaciones.")
    if party not in parties_for_user(match, user):
        raise PermissionDenied("No está asignado a este partido como " + Party(party).label.lower() + ".")
    status = party_status(match, party)
    if status["response"] == MatchConfirmation.Response.ACCEPTED:
        raise ValidationError("Su asistencia ya fue confirmada y quedó bloqueada.")
    if status["under_review"]:
        raise ValidationError("Su rechazo está en revisión por las autoridades.")
    # Un rechazo ya resuelto por la autoridad permite volver a responder.

    confirmation = MatchConfirmation(
        match=match,
        assignment_version=match.assignment_version,
        party=party,
        response=response,
        reason=(reason or "").strip(),
        user=user,
    )
    confirmation.clean()
    confirmation.save()
    record(f"confirmation_{response}", match, user=user, changes={"party": party, "reason": confirmation.reason})

    if response == MatchConfirmation.Response.REJECTED:
        ReviewCase.objects.create(
            kind=ReviewCase.Kind.REJECTION,
            match=match,
            confirmation=confirmation,
            reason=confirmation.reason,
            raised_by=user,
        )
        notify_permission(
            "competition.resolve_reviewcase",
            "Rechazo de asignación en revisión",
            f"{Party(party).label} rechazó {match}. Motivo: {confirmation.reason}",
            level="danger",
            link="/app/revisiones",
        )
    else:
        evaluate_match(match)
    return confirmation


def evaluate_match(match: Match) -> None:
    """
    Si el delegado y la terna arbitral confirmaron, el partido queda válido y bloqueado. Recién entonces se
    avisa a los equipos, que confirman su asistencia de forma informativa (no condiciona la validez).
    """
    if match.status == Match.Status.PENDING and officials_confirmed(match):
        match.status = Match.Status.CONFIRMED
        match.save(update_fields=["status", "updated_at"])
        when = f"{timezone.localtime(match.scheduled_start):%d/%m/%Y a las %H:%M} en {match.field}"
        teams = set()
        for party in (Party.HOME, Party.AWAY):
            teams |= party_user_ids(match, party)
        users = list(involved_users(match))
        notify([u for u in users if u.pk not in teams], "Partido confirmado",
               f"El partido {match} se llevará a cabo el {when}.", level="success", link=f"/app/partidos/{match.id}")
        notify([u for u in users if u.pk in teams], "Partido programado",
               f"{match} se jugará el {when}. Confirme la asistencia de su equipo.", level="success",
               link=f"/app/partidos/{match.id}")
        if match.matchday_id:
            evaluate_matchday(match.matchday)


def evaluate_matchday(matchday: Matchday) -> None:
    pending = matchday.matches.filter(status__in=[Match.Status.DRAFT, Match.Status.PENDING]).exists()
    if matchday.status == Matchday.Status.SUBMITTED and not pending:
        matchday.status = Matchday.Status.CONFIRMED
        matchday.confirmed_at = timezone.now()
        matchday.save(update_fields=["status", "confirmed_at", "updated_at"])
        record("matchday_confirmed", matchday)
        users = set()
        for match in matchday.matches.all():
            users |= set(involved_users(match))
        notify(users, "Jornada válida", f"{matchday} ({matchday.tournament}) quedó confirmada.", level="success",
               link="/app/jornadas")
