from django.core.exceptions import ValidationError
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models

from apps.core.models import BaseEntity
from apps.core.uploads import UploadTo
from apps.core.validators import validate_document_upload, validate_image_upload
from apps.registry.models import Category, Field, GameRules, Player, Team


class Tournament(BaseEntity):
    class Modality(models.TextChoices):
        LEAGUE = "league", "Liga (todos contra todos)"
        LEAGUE_DOUBLE = "league_double", "Liga ida y vuelta"
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
    # Formato de los partidos: ida y vuelta (dos partidos por cruce) o partido único.
    groups_double = models.BooleanField("fase de grupos ida y vuelta", default=False,
                                        help_text="Cada pareja de un grupo se enfrenta dos veces, invirtiendo la localía.")
    knockout_double = models.BooleanField("eliminación directa ida y vuelta", default=False,
                                          help_text="Cada cruce de la llave se define en dos partidos (marcador global).")
    final_single = models.BooleanField("final a partido único", default=True,
                                       help_text="Con ida y vuelta en la llave, la final igual se juega a un solo partido.")
    start_date = models.DateField("fecha de inicio", null=True, blank=True)
    end_date = models.DateField("fecha de fin", null=True, blank=True)

    # Puntuación (las reglas de juego son de cada categoría; ver CategoryRules para ajustes del torneo)
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

    def rules_for(self, category: Category) -> "Category | CategoryRules":
        """Reglas de juego de una categoría en el torneo: el ajuste del torneo si lo hay, si no las de la categoría."""
        for rules in self.category_rules.all():  # aprovecha prefetch_related("category_rules")
            if rules.category_id == category.pk and rules.is_active:
                return rules
        return category


class CategoryRules(BaseEntity, GameRules):
    """Ajuste de las reglas de juego de una categoría solo para este torneo (reemplaza a las de la categoría)."""

    tournament = models.ForeignKey(Tournament, verbose_name="torneo", on_delete=models.PROTECT,
                                   related_name="category_rules")
    category = models.ForeignKey(Category, verbose_name="categoría", on_delete=models.PROTECT, related_name="+")

    class Meta:
        ordering = ["tournament", "category__name"]
        verbose_name = "reglas por categoría"
        verbose_name_plural = "reglas por categoría"
        constraints = [
            models.UniqueConstraint(fields=["tournament", "category"], name="unique_category_rules"),
        ]

    def __str__(self):
        return f"Reglas {self.category} · {self.tournament}"

    def clean(self):
        if self.tournament_id and self.category_id and not self.tournament.categories.filter(
            pk=self.category_id
        ).exists():
            raise ValidationError({"category": "La categoría no está permitida en este torneo."})
        self.clean_rules()


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


class TeamPlayer(BaseEntity):
    """
    Nómina: jugador inscrito con un equipo en un torneo (para la categoría de esa inscripción).

    Un jugador solo puede estar activo en un equipo por torneo; en torneos distintos puede
    jugar con equipos distintos. El historial de cada equipo y de cada jugador sale de aquí.
    """

    registration = models.ForeignKey(TournamentTeam, verbose_name="inscripción", on_delete=models.PROTECT,
                                     related_name="roster")
    # Copia de registration.tournament para que la base de datos garantice la unicidad por torneo.
    tournament = models.ForeignKey(Tournament, verbose_name="torneo", on_delete=models.PROTECT,
                                   related_name="roster", editable=False)
    player = models.ForeignKey(Player, verbose_name="jugador", on_delete=models.PROTECT, related_name="entries")
    shirt_number = models.PositiveSmallIntegerField("dorsal", null=True, blank=True,
                                                    validators=[MaxValueValidator(99)])

    class Meta:
        ordering = ["registration", "shirt_number"]
        verbose_name = "jugador en nómina"
        verbose_name_plural = "nómina de jugadores"
        constraints = [
            models.UniqueConstraint(
                fields=["tournament", "player"], condition=models.Q(is_active=True),
                name="unique_active_player_per_tournament",
            ),
            models.UniqueConstraint(
                fields=["registration", "shirt_number"], condition=models.Q(is_active=True),
                name="unique_active_shirt_per_registration",
            ),
        ]

    def __str__(self):
        return f"{self.player} · {self.registration}"

    @property
    def team(self):
        return self.registration.team

    def save(self, *args, **kwargs):
        self.tournament_id = self.registration.tournament_id
        super().save(*args, **kwargs)

    def clean(self):
        errors = {}
        registration = self.registration if self.registration_id else None
        player = self.player if self.player_id else None
        if registration and not registration.is_active:
            errors["registration"] = "La inscripción del equipo en el torneo está inactiva."
        if registration and registration.tournament.status == Tournament.Status.FINISHED:
            errors["registration"] = "El torneo ya finalizó: su nómina no se modifica."
        if player and not player.is_active:
            errors["player"] = "El jugador está inactivo."
        elif registration and player:
            if not registration.category.is_player_eligible(player):
                errors["player"] = (
                    f"El jugador nació en {player.birth_date.year} y no es elegible para {registration.category} "
                    f"(nacidos desde {registration.category.birth_year_limit})."
                )
            other = (TeamPlayer.objects.filter(tournament_id=registration.tournament_id, player=player, is_active=True)
                     .exclude(pk=self.pk).select_related("registration__team").first())
            if other:
                where = ("este equipo" if other.registration.team_id == registration.team_id
                         else f"«{other.registration.team.name}»")
                errors["player"] = f"El jugador ya está inscrito con {where} en este torneo."
        if registration and self.shirt_number is not None and TeamPlayer.objects.filter(
            registration=registration, shirt_number=self.shirt_number, is_active=True
        ).exclude(pk=self.pk).exists():
            errors["shirt_number"] = "Ese dorsal ya está asignado en la nómina."
        if errors:
            raise ValidationError(errors)
