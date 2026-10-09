from django.conf import settings
from django.db import models

from apps.core.models import ImmutableModel


class TermsVersion(ImmutableModel):
    """Versión de los términos y condiciones. Nunca se edita: se publica una nueva versión."""

    version = models.CharField(max_length=20, unique=True)
    title = models.CharField(max_length=200, default="Términos y Condiciones de Uso de FutOwl")
    content = models.TextField(help_text="Contenido en Markdown")
    published_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, null=True, blank=True, related_name="+"
    )

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "versión de términos"
        verbose_name_plural = "versiones de términos"

    def __str__(self):
        return f"Términos v{self.version}"


class TermsAcceptance(ImmutableModel):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="terms_acceptances")
    terms = models.ForeignKey(TermsVersion, on_delete=models.PROTECT, related_name="acceptances")
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.CharField(max_length=255, blank=True)

    class Meta:
        unique_together = [("user", "terms")]
        verbose_name = "aceptación de términos"
        verbose_name_plural = "aceptaciones de términos"
