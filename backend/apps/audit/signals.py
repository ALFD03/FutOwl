"""Auditoría automática de altas y modificaciones de todos los modelos de FutOwl."""
from django.db.models.signals import post_save, pre_save
from django.dispatch import receiver

from .models import AuditLog
from .services import record

IGNORED_FIELDS = {"updated_at", "created_at", "vat_hash", "last_login", "password"}
IGNORED_MODELS = {"auditlog", "notification"}


def _is_audited(sender) -> bool:
    module = sender.__module__
    return module.startswith("apps.") and sender._meta.model_name not in IGNORED_MODELS and sender is not AuditLog


def _snapshot(instance) -> dict:
    data = {}
    for field in instance._meta.concrete_fields:
        if field.name in IGNORED_FIELDS:
            continue
        value = getattr(instance, field.attname)
        if hasattr(value, "name"):  # archivos
            value = value.name
        data[field.name] = value if isinstance(value, (str, int, float, bool, type(None))) else str(value)
    return data


@receiver(pre_save)
def capture_previous_state(sender, instance, raw=False, **kwargs):
    if raw or not _is_audited(sender) or instance._state.adding or not instance.pk:
        return
    previous = sender._base_manager.filter(pk=instance.pk).first()
    instance._audit_previous = _snapshot(previous) if previous else None


@receiver(post_save)
def log_save(sender, instance, created, raw=False, **kwargs):
    if raw or not _is_audited(sender):
        return
    current = _snapshot(instance)
    if created:
        record("create", instance, changes=current)
        return
    previous = getattr(instance, "_audit_previous", None) or {}
    diff = {k: {"antes": previous.get(k), "despues": v} for k, v in current.items() if previous.get(k) != v}
    if diff:
        record("update", instance, changes=diff)
