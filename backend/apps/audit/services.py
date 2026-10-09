"""API de auditoría: `record()` registra cualquier acción del sistema."""
from django.db import transaction

from .context import client_ip, current_user, get_request
from .models import AuditLog

SENSITIVE_FIELDS = {"password", "vat_number", "phone", "guardian_phone", "manager_phone"}


def mask(changes: dict) -> dict:
    masked = {}
    for key, value in (changes or {}).items():
        if key in SENSITIVE_FIELDS or "phone" in key:
            masked[key] = "***cifrado***"
        else:
            masked[key] = value
    return masked


def record(action: str, instance=None, *, user=None, changes: dict | None = None, label: str | None = None):
    request = get_request()
    user = user if user is not None and getattr(user, "is_authenticated", False) else current_user()
    entry = AuditLog(
        user=user,
        username=getattr(user, "username", "") or "sistema",
        action=action,
        changes=mask(changes or {}),
    )
    if instance is not None:
        entry.app_label = instance._meta.app_label
        entry.model = instance._meta.model_name
        entry.object_id = str(instance.pk or "")
        entry.object_repr = (label or str(instance))[:255]
    elif label:
        entry.object_repr = label[:255]
    if request is not None:
        entry.ip_address = client_ip(request)
        entry.user_agent = request.META.get("HTTP_USER_AGENT", "")[:255]
        entry.path = request.path[:255]
        entry.method = request.method
    with transaction.atomic():
        last = AuditLog.objects.select_for_update().order_by("-id").only("hash").first()
        entry.prev_hash = last.hash if last else "GENESIS"
        entry.hash = entry.compute_hash()
        entry.save()
    return entry


def verify_chain() -> dict:
    """Recalcula la cadena completa y devuelve el primer asiento alterado (si existe)."""
    prev = "GENESIS"
    checked = 0
    for entry in AuditLog.objects.order_by("id").iterator():
        if entry.prev_hash != prev or entry.compute_hash() != entry.hash:
            return {"valid": False, "checked": checked, "broken_at": entry.id}
        prev = entry.hash
        checked += 1
    return {"valid": True, "checked": checked, "broken_at": None}
