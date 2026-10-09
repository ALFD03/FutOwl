"""Programación: validaciones de solapamiento, envío de jornadas y ajustes con exposición de motivos."""
from django.core.exceptions import ValidationError
from django.db import transaction
from django.db.models import Q
from django.utils import timezone

from apps.audit.services import record
from apps.notifications.services import notify

from ..models import Match, MatchAdjustment, Matchday, Party
from .parties import involved_users, required_official_parties

ACTIVE_STATUSES = [s for s in Match.Status.values if s != Match.Status.SUSPENDED]

OFFICIAL_FIELDS = {
    "delegate": Party.DELEGATE,
    "referee": Party.REFEREE,
    "assistant_referee_1": Party.ASSISTANT_1,
    "assistant_referee_2": Party.ASSISTANT_2,
}
REFEREE_FIELDS = ["referee", "assistant_referee_1", "assistant_referee_2"]


def _overlapping(match: Match):
    return (
        Match.objects.filter(
            status__in=ACTIVE_STATUSES,
            scheduled_start__lt=match.scheduled_end,
            scheduled_end__gt=match.scheduled_start,
        )
        .exclude(pk=match.pk)
        .select_related("field")
    )


def validate_schedule(match: Match) -> None:
    """
    Reglas de no solapamiento:
    - Una cancha admite tantos partidos simultáneos como su capacidad (mini canchas si es divisible).
    - Un mismo delegado, árbitro o equipo no puede estar en dos partidos a la vez.
    Asigna automáticamente la mini cancha libre si no se indicó.
    """
    if not (match.scheduled_start and match.scheduled_end):
        return
    overlapping = _overlapping(match)
    errors = {}

    if match.field_id:
        same_field = list(overlapping.filter(field_id=match.field_id))
        capacity = match.field.capacity
        if len(same_field) >= capacity:
            errors["field"] = (
                f"La cancha {match.field} ya tiene {len(same_field)} partido(s) en ese horario "
                f"(capacidad simultánea: {capacity})."
            )
        else:
            used = {m.sub_field or 1 for m in same_field}
            if match.sub_field and match.sub_field in used:
                errors["sub_field"] = f"La mini cancha {match.sub_field} está ocupada en ese horario."
            elif not match.sub_field and capacity > 1:
                match.sub_field = next(n for n in range(1, capacity + 1) if n not in used)

    if match.delegate_id and overlapping.filter(delegate_id=match.delegate_id).exists():
        errors["delegate"] = "El delegado ya tiene otro partido asignado en ese horario."

    for field in REFEREE_FIELDS:
        ref_id = getattr(match, f"{field}_id")
        if ref_id and overlapping.filter(
            Q(referee_id=ref_id) | Q(assistant_referee_1_id=ref_id) | Q(assistant_referee_2_id=ref_id)
        ).exists():
            errors[field] = "El árbitro ya tiene otro partido asignado en ese horario."

    teams = [match.home_id, match.away_id]
    if overlapping.filter(Q(home_id__in=teams) | Q(away_id__in=teams)).exists():
        errors["home"] = "Uno de los equipos ya juega otro partido en ese horario."

    if errors:
        raise ValidationError(errors)


def missing_fields(match: Match) -> list[str]:
    required = ["matchday", "field", "scheduled_start", "scheduled_end"]
    official_fields = {v: k for k, v in OFFICIAL_FIELDS.items()}
    required += [official_fields[p] for p in required_official_parties(match)]
    return [f for f in required if not getattr(match, f"{f}_id", None) and not getattr(match, f, None)]


def matchday_completeness(matchday: Matchday) -> dict:
    matches = list(matchday.matches.select_related("tournament"))
    incomplete = {m.id: missing_fields(m) for m in matches}
    incomplete = {k: v for k, v in incomplete.items() if v}
    return {"total": len(matches), "incomplete": incomplete, "ready": bool(matches) and not incomplete}


@transaction.atomic
def submit_matchday(matchday: Matchday, user) -> Matchday:
    """Envía la jornada: bloquea las asignaciones y solicita confirmación a los involucrados."""
    matchday = Matchday.objects.select_for_update().get(pk=matchday.pk)
    if matchday.status != Matchday.Status.DRAFT:
        raise ValidationError("Solo se pueden enviar jornadas en borrador.")
    status = matchday_completeness(matchday)
    if not status["ready"]:
        raise ValidationError({
            "matches": "La jornada no tiene partidos o hay partidos con campos sin completar.",
            "incomplete": status["incomplete"],
        })
    for match in matchday.matches.all():
        validate_schedule(match)
        if timezone.localtime(match.scheduled_start).date() != matchday.date:
            raise ValidationError({"matches": f"El partido {match} no está programado el día de la jornada."})
        match.status = Match.Status.PENDING
        match.save(update_fields=["status", "sub_field", "updated_at"])
        notify(
            involved_users(match),
            "Nueva asignación pendiente de confirmación",
            f"{match} · {timezone.localtime(match.scheduled_start):%d/%m/%Y %H:%M} · {match.field}. "
            "Confirme o rechace su asistencia.",
            level="warning",
            link=f"/app/partidos/{match.id}",
        )
    matchday.status = Matchday.Status.SUBMITTED
    matchday.submitted_at = timezone.now()
    matchday.submitted_by = user
    matchday.save()
    record("submit_matchday", matchday, user=user)
    return matchday


ADJUSTABLE_FIELDS = ["field", "sub_field", "scheduled_start", "scheduled_end", *OFFICIAL_FIELDS]


def _affected_parties(changed: set[str], match: Match) -> list[str]:
    if changed & {"field", "sub_field", "scheduled_start", "scheduled_end"}:
        return [*required_official_parties(match), Party.HOME, Party.AWAY]
    return [OFFICIAL_FIELDS[f] for f in changed if f in OFFICIAL_FIELDS]


def _serialize(value):
    if hasattr(value, "pk"):
        return {"id": value.pk, "label": str(value)}
    if hasattr(value, "isoformat"):
        return value.isoformat()
    return value


@transaction.atomic
def adjust_match(match: Match, changes: dict, reason: str, user) -> MatchAdjustment:
    """
    Modifica un partido ya enviado dejando constancia (antes/después + motivo).
    Las partes afectadas deben volver a confirmar.
    """
    match = Match.objects.select_for_update().get(pk=match.pk)
    if match.status not in (Match.Status.PENDING, Match.Status.CONFIRMED):
        raise ValidationError("Solo se pueden ajustar partidos pendientes o confirmados que no hayan iniciado.")
    if not reason or len(reason.strip()) < 10:
        raise ValidationError({"reason": "La exposición de motivos es obligatoria (mínimo 10 caracteres)."})
    invalid = set(changes) - set(ADJUSTABLE_FIELDS)
    if invalid:
        raise ValidationError({"changes": f"Campos no ajustables: {', '.join(sorted(invalid))}"})

    diff = {}
    for field, value in changes.items():
        before = getattr(match, field)
        if before != value:
            diff[field] = {"antes": _serialize(before), "despues": _serialize(value)}
            setattr(match, field, value)
    if not diff:
        raise ValidationError("No hay cambios que registrar.")

    match.full_clean(exclude=["created_by"])
    validate_schedule(match)
    affected = _affected_parties(set(diff), match)
    adjustment = MatchAdjustment.objects.create(
        match=match,
        version_from=match.assignment_version,
        version_to=match.assignment_version + 1,
        changes=diff,
        affected_parties=affected,
        reason=reason.strip(),
        user=user,
    )
    match.assignment_version += 1
    if any(p in affected for p in required_official_parties(match)):
        match.status = Match.Status.PENDING
    match.save()
    if match.matchday and match.matchday.status == Matchday.Status.CONFIRMED and match.status == Match.Status.PENDING:
        match.matchday.status = Matchday.Status.SUBMITTED
        match.matchday.save(update_fields=["status", "updated_at"])
    notify(
        involved_users(match),
        "Ajuste en partido asignado",
        f"{match}: se modificaron {', '.join(diff)}. Motivo: {reason.strip()}",
        level="warning",
        link=f"/app/partidos/{match.id}",
    )
    return adjustment
