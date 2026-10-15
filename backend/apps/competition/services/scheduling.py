"""Programación: validaciones de solapamiento, envío de jornadas y ajustes con exposición de motivos."""
from datetime import timedelta
from datetime import timezone as dt_timezone

from django.core.exceptions import ValidationError
from django.db import transaction
from django.db.models import Q
from django.utils import timezone

from apps.audit.services import record
from apps.notifications.services import notify, notify_permission

from ..models import Match, MatchAdjustment, MatchConfirmation, Matchday, Party
from .parties import involved_users, party_status, party_user_ids, required_official_parties

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

    teams = [t for t in (match.home_id, match.away_id) if t]
    if overlapping.filter(Q(home_id__in=teams) | Q(away_id__in=teams)).exists():
        errors["home"] = "Uno de los equipos ya juega otro partido en ese horario."

    if errors:
        raise ValidationError(errors)


def missing_fields(match: Match) -> list[str]:
    """Lo que falta para enviar el partido: cancha y horario (los oficiales se asignan después del envío)."""
    required = ["matchday", "field", "scheduled_start", "scheduled_end", "home", "away"]
    return [f for f in required if not getattr(match, f"{f}_id", None) and not getattr(match, f, None)]


def missing_officials(match: Match) -> list[str]:
    official_fields = {v: k for k, v in OFFICIAL_FIELDS.items()}
    return [official_fields[p] for p in required_official_parties(match)
            if not getattr(match, f"{official_fields[p]}_id")]


@transaction.atomic
def add_matches(matchday: Matchday, ids: list[int], user, field=None) -> dict:
    """
    Agrega varios partidos del fixture a una jornada en borrador (opcionalmente ya en una cancha). Solo toma
    partidos del mismo torneo, en borrador y sin jornada; los demás se omiten.
    """
    if matchday.status != Matchday.Status.DRAFT:
        raise ValidationError("Solo se agregan partidos a jornadas en borrador.")
    if field is not None and matchday.tournament.fields.exists() and not matchday.tournament.fields.filter(pk=field.pk).exists():
        raise ValidationError({"field": "La cancha no está entre las del torneo."})
    selected = Match.objects.filter(pk__in=ids)
    eligible = selected.filter(tournament=matchday.tournament, status=Match.Status.DRAFT, matchday__isnull=True)
    changes = {"matchday": matchday}
    if field is not None:
        changes |= {"field": field, "sub_field": None}
    added = list(eligible.values_list("id", flat=True))
    eligible.update(**changes)
    if added:
        record("add_matches", matchday, user=user, changes={"partidos": added, "cancha": str(field) if field else None})
    return {"added": len(added), "skipped": selected.count() - len(added)}


def move_matchday_matches(matchday: Matchday, previous_day) -> int:
    """
    Tras cambiar el día de una jornada, lleva sus partidos programados al nuevo día con la misma hora local
    (inicio y fin) y vuelve a validar los solapamientos de ese día.
    """
    # Hora oficial fija UTC-4 (con la zona histórica, una fecha mal escrita como el año 6 usaría la hora solar).
    official = dt_timezone(timedelta(hours=-4))
    moved = 0
    for match in matchday.matches.select_related("field").exclude(scheduled_start=None):
        for attr in ("scheduled_start", "scheduled_end"):
            value = getattr(match, attr)
            if value is not None:
                local = value.astimezone(official)
                setattr(match, attr, local.replace(year=matchday.date.year, month=matchday.date.month, day=matchday.date.day))
        validate_schedule(match)
        match.save(update_fields=["scheduled_start", "scheduled_end", "sub_field", "updated_at"])
        moved += 1
    if moved:
        record("move_matchday", matchday, changes={"de": str(previous_day), "a": str(matchday.date), "partidos": moved})
    return moved


def matchday_completeness(matchday: Matchday) -> dict:
    matches = list(matchday.matches.select_related("tournament"))
    incomplete = {m.id: missing_fields(m) for m in matches}
    incomplete = {k: v for k, v in incomplete.items() if v}
    return {"total": len(matches), "incomplete": incomplete, "ready": bool(matches) and not incomplete}


@transaction.atomic
def submit_matchday(matchday: Matchday, user) -> Matchday:
    """
    Envía la jornada: cancha y horario quedan bloqueados. Se avisa a los jefes de delegados y de árbitros
    para que asignen a los oficiales; los ya asignados reciben la solicitud de confirmación. Los equipos
    se enteran cuando los oficiales confirman (ver confirmations.evaluate_match).
    """
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
        _request_official_confirmations(match, required_official_parties(match))
    matchday.status = Matchday.Status.SUBMITTED
    matchday.submitted_at = timezone.now()
    matchday.submitted_by = user
    matchday.save()
    record("submit_matchday", matchday, user=user)
    link = f"/app/jornadas/{matchday.id}"
    text = f"{matchday} ({matchday.tournament}): cancha y horario confirmados. Asigne a los oficiales de cada partido."
    notify_permission("competition.assign_delegate", "Jornada lista para asignar delegados", text, level="warning", link=link)
    notify_permission("competition.assign_referees", "Jornada lista para asignar árbitros", text, level="warning", link=link)
    return matchday


def _request_official_confirmations(match: Match, parties) -> None:
    """Pide confirmación a los oficiales asignados en esas posiciones (los equipos se avisan al confirmar)."""
    users = set()
    for party in parties:
        users |= party_user_ids(match, party)
    if users:
        from django.contrib.auth import get_user_model

        notify(
            get_user_model().objects.filter(pk__in=users, is_active=True),
            "Nueva asignación pendiente de confirmación",
            f"{match} · {timezone.localtime(match.scheduled_start):%d/%m/%Y %H:%M} · {match.field}. "
            "Confirme o rechace su asistencia.",
            level="warning",
            link=f"/app/partidos/{match.id}",
        )


@transaction.atomic
def assign_officials(match: Match, changes: dict, user) -> Match:
    """
    Asigna delegado y árbitros a un partido enviado (pendiente de confirmación), sin exposición de motivos.
    Una posición cuyo oficial ya confirmó solo se cambia con un ajuste (adjust_match).
    """
    match = Match.objects.select_for_update().get(pk=match.pk)
    if match.status != Match.Status.PENDING:
        raise ValidationError("Solo se asignan oficiales a partidos enviados pendientes de confirmación; "
                              "si ya está confirmado, use un ajuste con exposición de motivos.")
    invalid = set(changes) - set(OFFICIAL_FIELDS)
    if invalid:
        raise ValidationError({"changes": f"Solo se asignan oficiales: {', '.join(sorted(invalid))} no se cambia aquí."})
    changed = {}
    for field, value in changes.items():
        if getattr(match, field) == value:
            continue
        party = OFFICIAL_FIELDS[field]
        if party_status(match, party)["response"] == MatchConfirmation.Response.ACCEPTED:
            raise ValidationError({field: f"{Party(party).label} ya confirmó: para cambiarlo use un ajuste."})
        changed[field] = {"antes": _serialize(getattr(match, field)), "despues": _serialize(value)}
        setattr(match, field, value)
    if not changed:
        raise ValidationError("No hay cambios que asignar.")
    match.full_clean(exclude=["created_by"])
    validate_schedule(match)
    match.save()
    record("assign_officials", match, user=user, changes=changed)
    _request_official_confirmations(match, [OFFICIAL_FIELDS[f] for f in changed])
    return match


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
