"""Confirmación/rechazo de asistencia de delegados, árbitros y equipos."""
from django.core.exceptions import PermissionDenied, ValidationError
from django.db import transaction
from django.utils import timezone

from apps.audit.services import record
from apps.notifications.services import notify, notify_permission

from ..models import Match, MatchConfirmation, Matchday, Party, ReviewCase
from .parties import involved_users, officials_confirmed, parties_for_user, party_status


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
    """Si delegado y terna arbitral confirmaron, el partido queda válido."""
    if match.status == Match.Status.PENDING and officials_confirmed(match):
        match.status = Match.Status.CONFIRMED
        match.save(update_fields=["status", "updated_at"])
        notify(
            involved_users(match),
            "Partido confirmado",
            f"El partido {match} se llevará a cabo el {timezone.localtime(match.scheduled_start):%d/%m/%Y a las %H:%M}"
            f" en {match.field}.",
            level="success",
            link=f"/app/partidos/{match.id}",
        )
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
