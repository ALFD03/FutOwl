"""
Documentación de la aplicación (manual de usuario, preguntas frecuentes y permisos).

Cada página es Markdown editable solo por el superusuario. Las páginas no se borran:
se despublican (`is_active=False`). Cada versión guardada queda como revisión inalterable.
"""
from django.conf import settings
from django.db import models

from apps.core.models import BaseEntity, ImmutableModel


class DocPage(BaseEntity):
    """Página de documentación. `is_active` indica si está publicada."""

    class Section(models.TextChoices):
        MANUAL = "manual", "Manual de usuario"
        FAQ = "faq", "Preguntas frecuentes"
        PERMISSIONS = "permissions", "Roles y permisos"
        REFERENCE = "reference", "Referencia técnica"

    slug = models.SlugField("identificador", max_length=80, unique=True)
    title = models.CharField("título", max_length=150)
    summary = models.CharField("resumen", max_length=255, blank=True)
    section = models.CharField("sección", max_length=20, choices=Section.choices, default=Section.MANUAL)
    order = models.PositiveSmallIntegerField("orden", default=0)
    content = models.TextField("contenido (Markdown)", blank=True)
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, verbose_name="editado por", on_delete=models.PROTECT, null=True, blank=True,
        related_name="+",
    )

    class Meta:
        ordering = ["section", "order", "title"]
        verbose_name = "página de documentación"
        verbose_name_plural = "páginas de documentación"
        # La edición es exclusiva del superusuario: no se exponen permisos asignables a roles.
        default_permissions = ()

    def __str__(self):
        return self.title


class DocRevision(ImmutableModel):
    """Versión guardada de una página (permite consultar y restaurar contenido anterior)."""

    page = models.ForeignKey(DocPage, on_delete=models.PROTECT, related_name="revisions")
    title = models.CharField(max_length=150)
    content = models.TextField(blank=True)
    edited_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, null=True, blank=True,
                                  related_name="+")

    class Meta:
        ordering = ["-created_at", "-id"]
        verbose_name = "revisión de documentación"
        verbose_name_plural = "revisiones de documentación"
        default_permissions = ()
