"""Informes de delegado y árbitro, devoluciones, cierre de partidos y de jornadas."""
from django.core.exceptions import PermissionDenied, ValidationError
from django.db import transaction
from django.utils import timezone

from apps.audit.services import record
from apps.notifications.services import notify, notify_permission

from ..models import Match, MatchClosure, Matchday, MatchReport, ReportReturn, ReportRole
from .live import compute_state
from .parties import involved_users

ROLE_PERMS = {
    ReportRole.DELEGATE: "competition.submit_delegate_report",
    ReportRole.REFEREE: "competition.submit_referee_report",
}


def current_report(match: Match, role: str) -> MatchReport | None:
    """Última versión vigente (no devuelta) del informe."""
    report = match.reports.filter(role=role).order_by("-version").select_related("returned").first()
    if report is None or hasattr(report, "returned"):
        return None
    return report


def _assert_reporter(match: Match, role: str, user):
    if user.is_superuser:
        return
    if not user.has_perm(ROLE_PERMS[role]):
        raise PermissionDenied("No tiene permiso para enviar este informe.")
    official = match.delegate if role == ReportRole.DELEGATE else match.referee
    if official is None or official.user_id != user.pk:
        raise PermissionDenied("Solo el oficial asignado puede enviar este informe.")


@transaction.atomic
def submit_report(match: Match, role: str, user, data: dict) -> MatchReport:
    match = Match.objects.select_for_update().get(pk=match.pk)
    _assert_reporter(match, role, user)
    if match.status != Match.Status.FINISHED:
        raise ValidationError("El informe solo puede enviarse cuando el partido ha finalizado y antes del cierre.")
    if current_report(match, role) is not None:
        raise ValidationError("Ya envió su informe. Solo una autoridad puede devolverlo para corrección.")
    last = match.reports.filter(role=role).order_by("-version").first()
    report = MatchReport.objects.create(
        match=match, role=role, version=(last.version + 1) if last else 1, submitted_by=user,
        **{k: data.get(k, 0) for k in MatchReport.COMPARABLE},
        observations=data.get("observations", ""), attachment=data.get("attachment") or "",
    )
    other = ReportRole.REFEREE if role == ReportRole.DELEGATE else ReportRole.DELEGATE
    if current_report(match, other):
        notify_permission("competition.close_match", "Informes listos para cierre",
                          f"{match}: delegado y árbitro enviaron sus informes.", link=f"/app/partidos/{match.id}")
    return report


@transaction.atomic
def return_report(report: MatchReport, user, reason: str) -> ReportReturn:
    if report.match.status != Match.Status.FINISHED:
        raise ValidationError("Solo se devuelven informes de partidos finalizados sin cerrar.")
    if current_report(report.match, report.role) != report:
        raise ValidationError("Solo puede devolverse la versión vigente del informe.")
    if not reason or len(reason.strip()) < 5:
        raise ValidationError({"reason": "Debe indicar el motivo de la devolución."})
    returned = ReportReturn.objects.create(report=report, reason=reason.strip(), returned_by=user)
    notify([report.submitted_by], "Informe devuelto para corrección",
           f"{report.match}: {reason.strip()}", level="warning", link=f"/app/partidos/{report.match_id}")
    return returned


def compare(match: Match) -> dict:
    delegate = current_report(match, ReportRole.DELEGATE)
    referee = current_report(match, ReportRole.REFEREE)
    state = compute_state(match)
    events_tally = {
        "home_score": state["home_score"], "away_score": state["away_score"],
        "home_yellow": state["home"].yellow, "away_yellow": state["away"].yellow,
        "home_red": state["home"].red, "away_red": state["away"].red,
    }
    differences = []
    if delegate and referee:
        differences = [
            {"field": f, "delegate": getattr(delegate, f), "referee": getattr(referee, f)}
            for f in MatchReport.COMPARABLE if getattr(delegate, f) != getattr(referee, f)
        ]
    warnings = []
    for label, report in (("delegado", delegate), ("árbitro", referee)):
        if report:
            for f in MatchReport.COMPARABLE:
                if getattr(report, f) != events_tally[f]:
                    warnings.append(f"El informe del {label} difiere de la cronología en {f}.")
    return {
        "delegate_report_id": delegate.id if delegate else None,
        "referee_report_id": referee.id if referee else None,
        "both_submitted": bool(delegate and referee),
        "coincide": bool(delegate and referee and not differences),
        "differences": differences,
        "events_tally": events_tally,
        "warnings": warnings,
    }


@transaction.atomic
def close_match(match: Match, user, notes: str = "") -> MatchClosure:
    match = Match.objects.select_for_update().get(pk=match.pk)
    if match.status != Match.Status.FINISHED:
        raise ValidationError("Solo se cierran partidos finalizados.")
    comparison = compare(match)
    if not comparison["both_submitted"]:
        raise ValidationError("Faltan informes: delegado y árbitro deben enviar los suyos.")
    if not comparison["coincide"]:
        raise ValidationError({"detail": "Los informes no coinciden. Devuelva el informe que corresponda.",
                               "differences": comparison["differences"]})
    delegate = MatchReport.objects.get(pk=comparison["delegate_report_id"])
    referee = MatchReport.objects.get(pk=comparison["referee_report_id"])
    closure = MatchClosure.objects.create(
        match=match, home_score=delegate.home_score, away_score=delegate.away_score,
        delegate_report=delegate, referee_report=referee, notes=notes, closed_by=user,
    )
    match.status = Match.Status.CLOSED
    match.home_score, match.away_score = delegate.home_score, delegate.away_score
    match.save()
    record("close_match", match, user=user, changes={"resultado": f"{match.home_score}-{match.away_score}"})
    notify(involved_users(match), "Partido cerrado",
           f"{match} cerrado oficialmente: {match.home_score}-{match.away_score}.", level="success",
           link=f"/app/partidos/{match.id}")
    return closure


@transaction.atomic
def suspend_match(match: Match, user, reason: str) -> Match:
    match = Match.objects.select_for_update().get(pk=match.pk)
    if match.status in (Match.Status.CLOSED, Match.Status.SUSPENDED):
        raise ValidationError("El partido ya está cerrado o suspendido.")
    if not reason or len(reason.strip()) < 10:
        raise ValidationError({"reason": "La exposición de motivos es obligatoria (mínimo 10 caracteres)."})
    previous = match.status
    match.status = Match.Status.SUSPENDED
    match.save()
    record("suspend_match", match, user=user, changes={"estado_anterior": previous, "motivo": reason.strip()})
    notify(involved_users(match), "Partido suspendido", f"{match}: {reason.strip()}", level="danger",
           link=f"/app/partidos/{match.id}")
    return match


@transaction.atomic
def close_matchday(matchday: Matchday, user) -> Matchday:
    matchday = Matchday.objects.select_for_update().get(pk=matchday.pk)
    if matchday.status == Matchday.Status.CLOSED:
        raise ValidationError("La jornada ya está cerrada.")
    open_matches = matchday.matches.exclude(status__in=[Match.Status.CLOSED, Match.Status.SUSPENDED])
    if open_matches.exists():
        raise ValidationError({"detail": "Todos los partidos deben estar cerrados o suspendidos.",
                               "open_matches": list(open_matches.values_list("id", flat=True))})
    matchday.status = Matchday.Status.CLOSED
    matchday.closed_at = timezone.now()
    matchday.closed_by = user
    matchday.save()
    record("close_matchday", matchday, user=user)
    return matchday
