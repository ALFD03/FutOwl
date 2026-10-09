from django.core.exceptions import ValidationError
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models

from apps.core.models import BaseEntity
from apps.core.uploads import UploadTo
from apps.core.validators import validate_document_upload, validate_image_upload
from apps.registry.models import Category, Field, Team


class Tournament(BaseEntity):
    class Modality(models.TextChoices):
        LEAGUE = "league", "Liga (todos contra todos)"
        LEAGUE_DOUBLE = "league_double", "Liga ida y vuelta"
        GROUPS = "groups", "Fase de grupos"
        GROUPS_KNOCKOUT = "groups_knockout", "Grupos + eliminación directa"
        KNOCKOUT = "knockout", "Eliminación directa"

    class Status(models.TextChoices):
        DRAFT = "draft", "Borrador"
        REGISTRATION = "registration", "Inscripciones"
        IN_PROGRESS = "in_progress", "En curso"
        FINISHED = "finished", "Finalizado"

    name = models.CharField("nombre", max_length=150, unique=True)
    logo = models.ImageField("logo", upload_to=UploadTo("logos/tournaments"), validators=[validate_image_upload],
                             blank=True)
    modality = models.CharField("modalidad", max_length=20, choices=Modality.choices, default=Modality.LEAGUE)
    status = models.CharField("estado", max_length=20, choices=Status.choices, default=Status.DRAFT)
    categories = models.ManyToManyField(Category, verbose_name="categorías permitidas", related_name="tournaments")
    fields = models.ManyToManyField(Field, verbose_name="canchas disponibles", related_name="tournaments",
                                    blank=True)
    start_date = models.DateField("fecha de inicio", null=True, blank=True)
    end_date = models.DateField("fecha de fin", null=True, blank=True)

    # Reglas de juego
    match_duration_minutes = models.PositiveSmallIntegerField(
        "duración del partido (min)", default=60, validators=[MinValueValidator(10), MaxValueValidator(150)]
    )
    periods = models.PositiveSmallIntegerField("tiempos", default=2, validators=[MinValueValidator(1),
                                                                                  MaxValueValidator(4)])
    break_minutes = models.PositiveSmallIntegerField("descanso (min)", default=10)
    max_substitutions = models.PositiveSmallIntegerField("cambios máximos", null=True, blank=True,
                                                         help_text="Vacío = ilimitados")
    max_lineup_players = models.PositiveSmallIntegerField("jugadores por planilla", default=18)
    starters_count = models.PositiveSmallIntegerField("titulares", default=11)
    referees_required = models.PositiveSmallIntegerField(
        "árbitros requeridos (terna)", default=3, validators=[MinValueValidator(1), MaxValueValidator(3)]
    )
    points_win = models.PositiveSmallIntegerField("puntos por victoria", default=3)
    points_draw = models.PositiveSmallIntegerField("puntos por empate", default=1)
    points_loss = models.PositiveSmallIntegerField("puntos por derrota", default=0)

    # Documentación (exportable / importable)
    regulation_text = models.TextField("reglamento (texto)", blank=True)
    regulation_file = models.FileField("reglamento (archivo)", upload_to=UploadTo("tournaments/regulations"),
                                       validators=[validate_document_upload], blank=True)
    lineup_sheet_file = models.FileField("planilla de alineación (plantilla)",
                                         upload_to=UploadTo("tournaments/templates"),
                                         validators=[validate_document_upload], blank=True)
    substitution_card_file = models.FileField("tarjeta de cambio (plantilla)",
                                              upload_to=UploadTo("tournaments/templates"),
                                              validators=[validate_document_upload], blank=True)

    class Meta:
        ordering = ["-start_date", "name"]
        verbose_name = "torneo"
        verbose_name_plural = "torneos"

    def __str__(self):
        return self.name

    def clean(self):
        if self.start_date and self.end_date and self.end_date < self.start_date:
            raise ValidationError({"end_date": "La fecha de fin no puede ser anterior a la de inicio."})
        if self.starters_count and self.max_lineup_players and self.starters_count > self.max_lineup_players:
            raise ValidationError({"starters_count": "Los titulares no pueden superar el máximo de la planilla."})


class Group(BaseEntity):
    tournament = models.ForeignKey(Tournament, on_delete=models.PROTECT, related_name="groups")
    category = models.ForeignKey(Category, on_delete=models.PROTECT, related_name="+")
    name = models.CharField("nombre", max_length=40, help_text="Ej.: Grupo A")

    class Meta:
        ordering = ["tournament", "category", "name"]
        verbose_name = "grupo"
        verbose_name_plural = "grupos"
        constraints = [
            models.UniqueConstraint(fields=["tournament", "category", "name"], name="unique_group_name"),
        ]

    def __str__(self):
        return f"{self.name} · {self.category}"


class TournamentTeam(BaseEntity):
    """Inscripción de un equipo en un torneo para una categoría."""

    tournament = models.ForeignKey(Tournament, on_delete=models.PROTECT, related_name="registrations")
    team = models.ForeignKey(Team, on_delete=models.PROTECT, related_name="registrations")
    category = models.ForeignKey(Category, on_delete=models.PROTECT, related_name="registrations")
    group = models.ForeignKey(Group, on_delete=models.PROTECT, null=True, blank=True, related_name="teams")

    class Meta:
        ordering = ["tournament", "category", "team__name"]
        verbose_name = "equipo inscrito"
        verbose_name_plural = "equipos inscritos"
        constraints = [
            models.UniqueConstraint(fields=["tournament", "team", "category"], name="unique_registration"),
        ]

    def __str__(self):
        return f"{self.team.name} ({self.category.name})"

    def clean(self):
        errors = {}
        if self.tournament_id and self.category_id and not self.tournament.categories.filter(
            pk=self.category_id
        ).exists():
            errors["category"] = "La categoría no está permitida en este torneo."
        if self.team_id and self.category_id and not self.team.categories.filter(pk=self.category_id).exists():
            errors["team"] = "El equipo no tiene registrada esta categoría."
        if self.group_id and (self.group.tournament_id != self.tournament_id or
                              self.group.category_id != self.category_id):
            errors["group"] = "El grupo no corresponde al torneo/categoría."
        if errors:
            raise ValidationError(errors)
