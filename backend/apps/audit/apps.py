from django.apps import AppConfig


class AuditConfig(AppConfig):
    name = "apps.audit"
    verbose_name = "Auditoría"

    def ready(self):
        from . import signals  # noqa: F401
