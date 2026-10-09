"""
Modelos abstractos reutilizables.

- TimeStampedModel: fechas de creación/actualización.
- BaseEntity: registro maestro sin borrado físico (se desactiva).
- ImmutableModel: registro de solo inserción (no se edita ni se borra).
- AddressMixin: dirección en varios campos.
- IdentityDocumentMixin: documento de identidad cifrado (tipo + número) con índice ciego.
"""
from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models

from .crypto import blind_index
from .fields import EncryptedCharField
from .uploads import UploadTo
from .validators import phone_validator, validate_document_upload, validate_image_upload, vat_number_validator


class ImmutableRecordError(ValidationError):
    """Se intenta modificar o borrar un registro inalterable."""


class TimeStampedModel(models.Model):
    created_at = models.DateTimeField("creado", auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField("actualizado", auto_now=True)

    class Meta:
        abstract = True


class BaseEntity(TimeStampedModel):
    """Entidad maestra: editable pero nunca se borra físicamente."""

    is_active = models.BooleanField("activo", default=True, db_index=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        verbose_name="creado por",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="+",
        editable=False,
    )

    class Meta:
        abstract = True

    def delete(self, *args, **kwargs):
        raise ImmutableRecordError("Los registros no se eliminan: use la desactivación.")


class ImmutableQuerySet(models.QuerySet):
    def update(self, **kwargs):
        raise ImmutableRecordError("Registro inalterable: no se permite la actualización masiva.")

    def delete(self):
        raise ImmutableRecordError("Registro inalterable: no se permite el borrado.")


class ImmutableModel(models.Model):
    """Registro de solo inserción (asientos). Las correcciones se hacen con nuevos asientos."""

    created_at = models.DateTimeField("registrado", auto_now_add=True, db_index=True)

    objects = ImmutableQuerySet.as_manager()

    class Meta:
        abstract = True

    def save(self, *args, **kwargs):
        if not self._state.adding:
            raise ImmutableRecordError("Registro inalterable: no puede editarse una vez creado.")
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise ImmutableRecordError("Registro inalterable: no puede eliminarse.")


class AddressMixin(models.Model):
    country = models.CharField("país", max_length=80, default="Venezuela")
    state = models.CharField("estado", max_length=80)
    municipality = models.CharField("municipio", max_length=120)
    address = models.CharField("dirección", max_length=255)

    class Meta:
        abstract = True

    @property
    def full_address(self) -> str:
        return ", ".join(p for p in [self.address, self.municipality, self.state, self.country] if p)


class PersonMixin(models.Model):
    first_name = models.CharField("nombres", max_length=120)
    last_name = models.CharField("apellidos", max_length=120)
    phone = EncryptedCharField("teléfono", blank=True, default="", validators=[phone_validator])
    photo = models.ImageField(
        "foto", upload_to=UploadTo("photos"), validators=[validate_image_upload], blank=True
    )

    class Meta:
        abstract = True

    @property
    def full_name(self) -> str:
        return f"{self.first_name} {self.last_name}".strip()

    def __str__(self):
        return self.full_name


class VatType(models.TextChoices):
    V = "V", "V - Venezolano"
    E = "E", "E - Extranjero"
    J = "J", "J - Jurídico"
    G = "G", "G - Gubernamental"


class IdentityDocumentMixin(models.Model):
    """Documento de identidad: tipo + número cifrado + foto del documento."""

    vat_id = models.CharField("tipo de documento", max_length=1, choices=VatType.choices, default=VatType.V)
    vat_number = EncryptedCharField("número de documento", validators=[vat_number_validator])
    vat_hash = models.CharField(max_length=64, unique=True, null=True, editable=False)
    document_photo = models.FileField(
        "foto del documento",
        upload_to=UploadTo("documents/identity"),
        validators=[validate_document_upload],
        blank=True,
    )

    class Meta:
        abstract = True

    @property
    def vat_display(self) -> str:
        return f"{self.vat_id}-{self.vat_number}" if self.vat_number else ""

    def compute_vat_hash(self) -> str | None:
        if not self.vat_number:
            return None
        return blind_index(f"{self.__class__.__name__}:{self.vat_id}{self.vat_number}")

    def save(self, *args, **kwargs):
        self.vat_hash = self.compute_vat_hash()
        super().save(*args, **kwargs)
