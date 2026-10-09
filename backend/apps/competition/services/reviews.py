from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone

from apps.notifications.services import notify

from ..models import ReviewCase


@transaction.atomic
def resolve_case(case: ReviewCase, user, status: str, resolution: str) -> ReviewCase:
    """
    Resuelve un caso. Para rechazos de asignación, la autoridad debe reasignar con un
    ajuste (exposición de motivos) o desestimar el rechazo; si se desestima, la parte
    podrá volver a responder.
    """
    if case.status != ReviewCase.Status.OPEN:
        raise ValidationError("El caso ya fue resuelto.")
    if status not in (ReviewCase.Status.RESOLVED, ReviewCase.Status.DISMISSED):
        raise ValidationError({"status": "Estado de resolución inválido."})
    if not resolution or len(resolution.strip()) < 5:
        raise ValidationError({"resolution": "Debe detallar la resolución."})
    case.status = status
    case.resolution = resolution.strip()
    case.resolved_by = user
    case.resolved_at = timezone.now()
    case.save()
    notify([case.raised_by], f"Caso {case.get_status_display().lower()}",
           f"{case.get_kind_display()} sobre {case.match}: {case.resolution}", link=f"/app/partidos/{case.match_id}")
    return case
