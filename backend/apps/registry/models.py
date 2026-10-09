"""
Registros maestros: categorías, canchas, entrenadores, representantes,
jugadores, delegados, árbitros y equipos.

La nómina de jugadores no vive aquí: es por torneo (`tournaments.TeamPlayer`), de modo
que un jugador se crea una sola vez y se inscribe en cada torneo con el equipo de turno.
"""
from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models

from apps.core.fields import EncryptedCharField
from apps.core.models import AddressMixin, BaseEntity, IdentityDocumentMixin, PersonMixin
from apps.core.timeutils import age_on, today
from apps.core.uploads import UploadTo
from apps.core.validators import (
    phone_validator,
    validate_document_upload,
    validate_image_upload,
    vat_number_validator,
)


class LicenseStatus(models.TextChoices):
    ENDORSED = "endorsed", "Avalado"
    NOT_ENDORSED = "not_endorsed", "No avalado"


class Category(BaseEntity):
    name = models.CharField("nombre", max_length=60, unique=True, help_text="Ej.: Sub 12")
    max_age = models.PositiveSmallIntegerField("tope de edad", validators=[MinValueValidator(1), MaxValueValidator(99)])

    class Meta:
        ordering = ["max_age", "name"]
        verbose_name = "categoría"
        verbose_name_plural = "categorías"

    def __str__(self):
        return self.name

    @property
    def birth_year_limit(self) -> int:
        """Año de nacimiento mínimo: se calcula contra el año en curso (tope 11 → 2015 en 2026, 2019 en 2030)."""
        return today().year - self.max_age

    def is_player_eligible(self, player: "Player") -> bool:
        return player.birth_date.year >= self.birth_year_limit


class Field(BaseEntity, AddressMixin):
    """Cancha. Si es divisible, admite tantos partidos simultáneos como mini canchas."""

    name = models.CharField("nombre", max_length=120)
    manager_name = models.CharField("responsable", max_length=160)
    manager_phone = EncryptedCharField("teléfono del responsable", validators=[phone_validator])
    length_m = models.DecimalField("largo / alto (m)", max_digits=6, decimal_places=2,
                                   validators=[MinValueValidator(1)])
    width_m = models.DecimalField("ancho (m)", max_digits=6, decimal_places=2, validators=[MinValueValidator(1)])
    is_divisible = models.BooleanField("divisible", default=False)
    mini_fields_count = models.PositiveSmallIntegerField(
        "cantidad de mini canchas", default=1, validators=[MinValueValidator(1), MaxValueValidator(16)]
    )

    class Meta:
        ordering = ["name"]
        verbose_name = "cancha"
        verbose_name_plural = "canchas"

    def __str__(self):
        return self.name

    @property
    def capacity(self) -> int:
        """Partidos que soporta en simultáneo."""
        return self.mini_fields_count if self.is_divisible else 1

    def clean(self):
        if not self.is_divisible:
            self.mini_fields_count = 1
        elif self.mini_fields_count < 2:
            raise ValidationError({"mini_fields_count": "Una cancha divisible debe tener al menos 2 mini canchas."})


class Coach(BaseEntity, PersonMixin, IdentityDocumentMixin):
    """Entrenador. Pertenece a un solo equipo a la vez y puede tener usuario para ayudar al gestor."""

    team = models.ForeignKey(
        "Team", verbose_name="equipo", on_delete=models.SET_NULL, null=True, blank=True, related_name="coaches"
    )
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, verbose_name="usuario", on_delete=models.PROTECT, null=True, blank=True,
        related_name="coach_profile",
    )
    license_number = models.CharField("licencia", max_length=60)
    license_photo = models.FileField(
        "foto de licencia", upload_to=UploadTo("documents/licenses"),
        validators=[validate_document_upload], blank=True,
    )
    license_expiry_year = models.PositiveSmallIntegerField(
        "año de vencimiento de licencia", validators=[MinValueValidator(2000), MaxValueValidator(2100)]
    )

    class Meta:
        ordering = ["last_name", "first_name"]
        verbose_name = "entrenador"
        verbose_name_plural = "entrenadores"

    @property
    def license_valid(self) -> bool:
        return self.license_expiry_year >= today().year

    def clean(self):
        """Un entrenador no puede dirigir a dos equipos distintos dentro del mismo torneo."""
        if not (self.pk and self.team_id):
            return
        previous = Coach.objects.filter(pk=self.pk).values_list("team_id", flat=True).first()
        if not previous or previous == self.team_id:
            return
        from apps.tournaments.models import Tournament

        shared = (
            Tournament.objects.exclude(status=Tournament.Status.FINISHED)
            .filter(registrations__team_id=previous, registrations__is_active=True)
            .filter(registrations__team_id=self.team_id)
            .distinct()
            .first()
        )
        if shared:
            raise ValidationError({"team": (
                f"El entrenador dirige a otro equipo en el torneo «{shared}». "
                "No puede estar en dos equipos del mismo torneo."
            )})


class Guardian(BaseEntity, IdentityDocumentMixin):
    """Representante legal de un jugador menor de edad."""

    first_name = models.CharField("nombres", max_length=120)
    last_name = models.CharField("apellidos", max_length=120)
    phone = EncryptedCharField("teléfono", validators=[phone_validator])
    relationship = models.CharField("parentesco", max_length=60, blank=True)

    class Meta:
        ordering = ["last_name", "first_name"]
        verbose_name = "representante"
        verbose_name_plural = "representantes"

    def __str__(self):
        return f"{self.first_name} {self.last_name}"


class Player(BaseEntity, PersonMixin, IdentityDocumentMixin):
    class DocumentKind(models.TextChoices):
        ID_CARD = "id_card", "Cédula de identidad"
        BIRTH_CERTIFICATE = "birth_certificate", "Partida de nacimiento"

    document_kind = models.CharField(
        "tipo de soporte", max_length=20, choices=DocumentKind.choices, default=DocumentKind.ID_CARD
    )
    # Opcional para menores que solo poseen partida de nacimiento.
    vat_number = EncryptedCharField("número de documento", blank=True, default="",
                                    validators=[vat_number_validator])
    birth_date = models.DateField("fecha de nacimiento")
    guardian = models.ForeignKey(
        Guardian, verbose_name="representante", on_delete=models.PROTECT, null=True, blank=True,
        related_name="players",
    )
    # Equipo que hoy administra la ficha (fotos, documento…). Cambia al inscribirlo en un torneo con otro equipo.
    current_team = models.ForeignKey(
        "Team", verbose_name="equipo actual", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="current_players",
    )

    class Meta:
        ordering = ["last_name", "first_name"]
        verbose_name = "jugador"
        verbose_name_plural = "jugadores"

    @property
    def age(self) -> int:
        return age_on(self.birth_date)

    @property
    def is_minor(self) -> bool:
        return self.age < 18

    def clean(self):
        errors = {}
        if self.birth_date and self.birth_date > today():
            errors["birth_date"] = "La fecha de nacimiento no puede ser futura."
        elif self.birth_date and self.is_minor and not (self.guardian_id or self.guardian):
            errors["guardian"] = "El representante es obligatorio para jugadores menores de 18 años."
        if self.document_kind == self.DocumentKind.ID_CARD and not self.vat_number:
            errors["vat_number"] = "La cédula es obligatoria cuando el soporte es cédula de identidad."
        if errors:
            raise ValidationError(errors)


class Official(BaseEntity, PersonMixin, IdentityDocumentMixin):
    """Base de delegados y árbitros."""

    license_status = models.CharField(
        "licencia", max_length=20, choices=LicenseStatus.choices, default=LicenseStatus.NOT_ENDORSED
    )

    class Meta:
        abstract = True
        ordering = ["last_name", "first_name"]


class Delegate(Official):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, verbose_name="usuario", on_delete=models.PROTECT, null=True, blank=True,
        related_name="delegate_profile",
    )

    class Meta(Official.Meta):
        verbose_name = "delegado"
        verbose_name_plural = "delegados"


class Referee(Official):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, verbose_name="usuario", on_delete=models.PROTECT, null=True, blank=True,
        related_name="referee_profile",
    )

    class Meta(Official.Meta):
        verbose_name = "árbitro"
        verbose_name_plural = "árbitros"


class Team(BaseEntity, AddressMixin, IdentityDocumentMixin):
    """Equipo. `vat_id`/`vat_number` representan el RIF."""

    name = models.CharField("nombre", max_length=150, unique=True)
    logo = models.ImageField("logo", upload_to=UploadTo("logos/teams"), validators=[validate_image_upload],
                             blank=True)
    categories = models.ManyToManyField(Category, verbose_name="categorías", related_name="teams", blank=True)
    home_field = models.ForeignKey(
        Field, verbose_name="cancha", on_delete=models.PROTECT, null=True, blank=True, related_name="teams"
    )
    managers = models.ManyToManyField(
        settings.AUTH_USER_MODEL, verbose_name="gestores", related_name="managed_teams", blank=True
    )

    class Meta:
        ordering = ["name"]
        verbose_name = "equipo"
        verbose_name_plural = "equipos"

    def __str__(self):
        return self.name

    def is_staff_user(self, user) -> bool:
        """Gestores del equipo y entrenadores con usuario: pueden administrar su plantilla."""
        if not (user and user.is_authenticated):
            return False
        return self.managers.filter(pk=user.pk).exists() or self.coaches.filter(user=user, is_active=True).exists()
