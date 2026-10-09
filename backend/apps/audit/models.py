import hashlib
import json

from django.conf import settings
from django.db import models

from apps.core.models import ImmutableModel


class AuditLog(ImmutableModel):
    """
    Bitácora auditable e inalterable. Cada asiento encadena el hash del anterior
    (cadena de integridad tipo blockchain): cualquier alteración rompe la cadena.
    """

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, null=True, blank=True, related_name="audit_logs"
    )
    username = models.CharField("usuario", max_length=150, blank=True)
    action = models.CharField("acción", max_length=60, db_index=True)
    app_label = models.CharField(max_length=60, blank=True, db_index=True)
    model = models.CharField(max_length=60, blank=True, db_index=True)
    object_id = models.CharField(max_length=64, blank=True, db_index=True)
    object_repr = models.CharField(max_length=255, blank=True)
    changes = models.JSONField(default=dict, blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.CharField(max_length=255, blank=True)
    path = models.CharField(max_length=255, blank=True)
    method = models.CharField(max_length=10, blank=True)
    prev_hash = models.CharField(max_length=64, blank=True)
    hash = models.CharField(max_length=64, unique=True)

    class Meta:
        ordering = ["-id"]
        verbose_name = "registro de auditoría"
        verbose_name_plural = "registros de auditoría"
        default_permissions = ("view",)
        permissions = [("verify_auditlog", "Puede verificar la integridad de la bitácora")]

    def __str__(self):
        return f"[{self.created_at:%Y-%m-%d %H:%M}] {self.username} {self.action} {self.model}#{self.object_id}"

    def payload(self) -> str:
        data = {
            "user": self.user_id,
            "username": self.username,
            "action": self.action,
            "app_label": self.app_label,
            "model": self.model,
            "object_id": self.object_id,
            "changes": self.changes,
            "ip": self.ip_address,
            "path": self.path,
            "method": self.method,
            "prev": self.prev_hash,
        }
        return json.dumps(data, sort_keys=True, default=str)

    def compute_hash(self) -> str:
        return hashlib.sha256(self.payload().encode()).hexdigest()
