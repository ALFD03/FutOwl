"""
Modelos de la competición.

Principio de inalterabilidad: una vez confirmadas, las operaciones no se editan
ni se borran. Los cambios quedan como nuevos asientos (ajustes, anulaciones,
devoluciones) que preservan la evidencia de lo anterior.
"""
from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.utils import timezone

from apps.core.models import ImmutableModel, ImmutableRecordError, TimeStampedModel
from apps.core.uploads import UploadTo
from apps.core.validators import validate_document_upload
from apps.registry.models import Coach, Delegate, Field, Referee
from apps.tournaments.models import Group, TeamPlayer, Tournament, TournamentTeam

User = settings.AUTH_USER_MODEL


class Party(models.TextChoices):
    """Partes involucradas en un partido que deben confirmar asistencia."""

    DELEGATE = "delegate", "Delegado"
    REFEREE = "referee", "Árbitro principal"
    ASSISTANT_1 = "assistant_1", "Árbitro asistente 1"
    ASSISTANT_2 = "assistant_2", "Árbitro asistente 2"
    HOME = "home", "Equipo local"
    AWAY = "away", "Equipo visitante"


OFFICIAL_PARTIES = [Party.DELEGATE, Party.REFEREE, Party.ASSISTANT_1, Party.ASSISTANT_2]
TEAM_PARTIES = [Party.HOME, Party.AWAY]


# ---------------------------------------------------------------------------
# Jornadas y partidos
# ---------------------------------------------------------------------------
class Matchday(TimeStampedModel):
    class Status(models.TextChoices):
        DRAFT = "draft", "Borrador"
        SUBMITTED = "submitted", "Enviada (pendiente de confirmaciones)"
        CONFIRMED = "confirmed", "Válida (confirmada)"
        CLOSED = "closed", "Cerrada"

    tournament = models.ForeignKey(Tournament, on_delete=models.PROTECT, related_name="matchdays")
    number = models.PositiveSmallIntegerField("número de jornada")
    name = models.CharField("nombre", max_length=120, blank=True)
    date = models.DateField("día de jornada")
    status = models.CharField(max_length=12, choices=Status.choices, default=Status.DRAFT, db_index=True)
    created_by = models.ForeignKey(User, on_delete=models.PROTECT, null=True, blank=True, related_name="+")
    submitted_at = models.DateTimeField(null=True, blank=True)
    submitted_by = models.ForeignKey(User, on_delete=models.PROTECT, null=True, blank=True, related_name="+")
    confirmed_at = models.DateTimeField(null=True, blank=True)
    closed_at = models.DateTimeField(null=True, blank=True)
    closed_by = models.ForeignKey(User, on_delete=models.PROTECT, null=True, blank=True, related_name="+")

    class Meta:
        ordering = ["tournament", "number"]
        verbose_name = "jornada"
        verbose_name_plural = "jornadas"
        constraints = [models.UniqueConstraint(fields=["tournament", "number"], name="unique_matchday_number")]
        permissions = [
            ("submit_matchday", "Puede enviar jornadas a confirmación"),
            ("close_matchday", "Puede cerrar jornadas"),
        ]

    def __str__(self):
        return self.name or f"Jornada {self.number}"

    def delete(self, *args, **kwargs):
        if self.status != self.Status.DRAFT:
            raise ImmutableRecordError("Solo se pueden eliminar jornadas en borrador.")
        super().delete(*args, **kwargs)


class Match(TimeStampedModel):
    class Status(models.TextChoices):
        DRAFT = "draft", "Borrador"
        PENDING = "pending", "Pendiente de confirmación"
        CONFIRMED = "confirmed", "Confirmado"
        IN_PROGRESS = "in_progress", "En juego"
        FINISHED = "finished", "Finalizado (informes pendientes)"
        CLOSED = "closed", "Cerrado"
        SUSPENDED = "suspended", "Suspendido"

    class Phase(models.TextChoices):
        NOT_STARTED = "not_started", "Por iniciar"
        PLAYING = "playing", "En juego"
        BREAK = "break", "Descanso"
        ENDED = "ended", "Terminado"

    LOCKED_FIELDS = [
        "field", "sub_field", "scheduled_start", "scheduled_end", "delegate", "referee",
        "assistant_referee_1", "assistant_referee_2", "home", "away", "matchday",
    ]

    tournament = models.ForeignKey(Tournament, on_delete=models.PROTECT, related_name="matches")
    category = models.ForeignKey("registry.Category", on_delete=models.PROTECT, related_name="+")
    group = models.ForeignKey(Group, on_delete=models.PROTECT, null=True, blank=True, related_name="matches")
    round_number = models.PositiveSmallIntegerField("fecha / ronda", default=1)
    home = models.ForeignKey(TournamentTeam, verbose_name="local", on_delete=models.PROTECT,
                             related_name="home_matches")
    away = models.ForeignKey(TournamentTeam, verbose_name="visitante", on_delete=models.PROTECT,
                             related_name="away_matches")
    matchday = models.ForeignKey(Matchday, on_delete=models.PROTECT, null=True, blank=True, related_name="matches")

    field = models.ForeignKey(Field, verbose_name="cancha", on_delete=models.PROTECT, null=True, blank=True,
                              related_name="matches")
    sub_field = models.PositiveSmallIntegerField("mini cancha", null=True, blank=True)
    scheduled_start = models.DateTimeField("inicio programado", null=True, blank=True, db_index=True)
    scheduled_end = models.DateTimeField("fin programado", null=True, blank=True)

    delegate = models.ForeignKey(Delegate, on_delete=models.PROTECT, null=True, blank=True, related_name="matches")
    referee = models.ForeignKey(Referee, verbose_name="árbitro principal", on_delete=models.PROTECT, null=True,
                                blank=True, related_name="matches_as_referee")
    assistant_referee_1 = models.ForeignKey(Referee, on_delete=models.PROTECT, null=True, blank=True,
                                            related_name="matches_as_assistant_1")
    assistant_referee_2 = models.ForeignKey(Referee, on_delete=models.PROTECT, null=True, blank=True,
                                            related_name="matches_as_assistant_2")

    status = models.CharField(max_length=12, choices=Status.choices, default=Status.DRAFT, db_index=True)
    phase = models.CharField(max_length=12, choices=Phase.choices, default=Phase.NOT_STARTED)
    current_period = models.PositiveSmallIntegerField(default=0)
    period_started_at = models.DateTimeField(null=True, blank=True)
    assignment_version = models.PositiveIntegerField(default=1)
    home_score = models.PositiveSmallIntegerField(null=True, blank=True)
    away_score = models.PositiveSmallIntegerField(null=True, blank=True)
    created_by = models.ForeignKey(User, on_delete=models.PROTECT, null=True, blank=True, related_name="+")

    class Meta:
        ordering = ["scheduled_start", "id"]
        verbose_name = "partido"
        verbose_name_plural = "partidos"
        permissions = [
            ("schedule_match", "Puede programar partidos (cancha, horario, oficiales)"),
            ("generate_fixture", "Puede generar el fixture"),
            ("adjust_match", "Puede ajustar partidos confirmados con exposición de motivos"),
            ("confirm_assignment", "Puede confirmar o rechazar su asignación"),
            ("operate_match", "Puede operar la mesa técnica de sus partidos"),
            ("operate_any_match", "Puede operar la mesa técnica de cualquier partido"),
            ("submit_lineup", "Puede cargar alineaciones de sus equipos"),
            ("verify_lineup", "Puede verificar documentación/alineaciones en mesa técnica"),
            ("submit_delegate_report", "Puede enviar el informe del delegado"),
            ("submit_referee_report", "Puede enviar el informe arbitral"),
            ("return_report", "Puede devolver informes para corrección"),
            ("close_match", "Puede cerrar partidos"),
            ("suspend_match", "Puede suspender partidos"),
        ]

    def __str__(self):
        return f"{self.home.team.name} vs {self.away.team.name}"

    @property
    def local_start(self):
        return timezone.localtime(self.scheduled_start) if self.scheduled_start else None

    @property
    def is_locked(self) -> bool:
        return self.status != self.Status.DRAFT

    def clean(self):
        errors = {}
        if self.home_id and self.away_id:
            if self.home_id == self.away_id:
                errors["away"] = "Un equipo no puede jugar contra sí mismo."
            elif self.home.category_id != self.away.category_id or self.home.tournament_id != self.away.tournament_id:
                errors["away"] = "Ambos equipos deben pertenecer al mismo torneo y categoría."
        if self.scheduled_start and self.scheduled_end and self.scheduled_end <= self.scheduled_start:
            errors["scheduled_end"] = "La hora de fin debe ser posterior a la de inicio."
        if self.field_id and self.sub_field and self.sub_field > self.field.capacity:
            errors["sub_field"] = f"La cancha solo tiene {self.field.capacity} mini cancha(s)."
        if self.matchday_id and self.matchday.tournament_id != self.tournament_id:
            errors["matchday"] = "La jornada pertenece a otro torneo."
        refs = [r for r in [self.referee_id, self.assistant_referee_1_id, self.assistant_referee_2_id] if r]
        if len(refs) != len(set(refs)):
            errors["referee"] = "Un árbitro no puede ocupar dos posiciones en la terna."
        if errors:
            raise ValidationError(errors)

    def party_official(self, party: str):
        return {
            Party.DELEGATE: self.delegate,
            Party.REFEREE: self.referee,
            Party.ASSISTANT_1: self.assistant_referee_1,
            Party.ASSISTANT_2: self.assistant_referee_2,
        }.get(party)

    def team_for(self, party: str) -> TournamentTeam | None:
        return {Party.HOME: self.home, Party.AWAY: self.away}.get(party)


class MatchConfirmation(ImmutableModel):
    class Response(models.TextChoices):
        ACCEPTED = "accepted", "Confirmado"
        REJECTED = "rejected", "Rechazado"

    match = models.ForeignKey(Match, on_delete=models.PROTECT, related_name="confirmations")
    assignment_version = models.PositiveIntegerField()
    party = models.CharField(max_length=12, choices=Party.choices)
    response = models.CharField(max_length=10, choices=Response.choices)
    reason = models.TextField(blank=True)
    user = models.ForeignKey(User, on_delete=models.PROTECT, related_name="+")

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "confirmación de asistencia"
        verbose_name_plural = "confirmaciones de asistencia"

    def clean(self):
        if self.response == self.Response.REJECTED and not self.reason.strip():
            raise ValidationError({"reason": "Debe indicar el motivo del rechazo."})


class MatchAdjustment(ImmutableModel):
    """Ajuste con exposición de motivos sobre un partido ya enviado/confirmado."""

    match = models.ForeignKey(Match, on_delete=models.PROTECT, related_name="adjustments")
    version_from = models.PositiveIntegerField()
    version_to = models.PositiveIntegerField()
    changes = models.JSONField(default=dict)
    affected_parties = models.JSONField(default=list)
    reason = models.TextField("exposición de motivos")
    user = models.ForeignKey(User, on_delete=models.PROTECT, related_name="+")

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "ajuste de partido"
        verbose_name_plural = "ajustes de partidos"


# ---------------------------------------------------------------------------
# Alineaciones
# ---------------------------------------------------------------------------
class Lineup(TimeStampedModel):
    class Status(models.TextChoices):
        SUBMITTED = "submitted", "Cargada"
        VERIFIED = "verified", "Verificada en mesa técnica"

    match = models.ForeignKey(Match, on_delete=models.PROTECT, related_name="lineups")
    team = models.ForeignKey(TournamentTeam, on_delete=models.PROTECT, related_name="lineups")
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.SUBMITTED)
    coach = models.ForeignKey(Coach, on_delete=models.PROTECT, null=True, blank=True, related_name="+")
    sheet_file = models.FileField("planilla firmada", upload_to=UploadTo("lineups"),
                                  validators=[validate_document_upload], blank=True)
    submitted_by = models.ForeignKey(User, on_delete=models.PROTECT, related_name="+")
    verified_by = models.ForeignKey(User, on_delete=models.PROTECT, null=True, blank=True, related_name="+")
    verified_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        verbose_name = "alineación"
        verbose_name_plural = "alineaciones"
        constraints = [models.UniqueConstraint(fields=["match", "team"], name="unique_lineup_per_team")]

    def __str__(self):
        return f"Alineación {self.team} · {self.match}"


class LineupPlayer(models.Model):
    lineup = models.ForeignKey(Lineup, on_delete=models.CASCADE, related_name="players")
    team_player = models.ForeignKey(TeamPlayer, on_delete=models.PROTECT, related_name="+")
    shirt_number = models.PositiveSmallIntegerField("dorsal")
    is_starter = models.BooleanField("titular", default=False)
    is_captain = models.BooleanField("capitán", default=False)

    class Meta:
        ordering = ["-is_starter", "shirt_number"]
        verbose_name = "jugador en alineación"
        verbose_name_plural = "jugadores en alineación"
        constraints = [
            models.UniqueConstraint(fields=["lineup", "team_player"], name="unique_lineup_player"),
            models.UniqueConstraint(fields=["lineup", "shirt_number"], name="unique_lineup_shirt"),
        ]


# ---------------------------------------------------------------------------
# Mesa técnica: cronología del partido
# ---------------------------------------------------------------------------
class MatchEvent(ImmutableModel):
    class Type(models.TextChoices):
        DELEGATE_ARRIVAL = "delegate_arrival", "Llegada del delegado"
        TEAM_ARRIVAL = "team_arrival", "Llegada de equipo"
        DOCUMENTS_VERIFIED = "documents_verified", "Documentación verificada"
        KICKOFF = "kickoff", "Inicio del partido"
        PERIOD_START = "period_start", "Inicio de tiempo"
        GOAL = "goal", "Gol"
        PENALTY_GOAL = "penalty_goal", "Gol de penal"
        OWN_GOAL = "own_goal", "Autogol"
        YELLOW_CARD = "yellow_card", "Tarjeta amarilla"
        RED_CARD = "red_card", "Tarjeta roja"
        SUBSTITUTION = "substitution", "Cambio"
        INCIDENT = "incident", "Incidencia"
        PERIOD_END = "period_end", "Fin de tiempo"
        MATCH_END = "match_end", "Fin del partido"
        ANNULMENT = "annulment", "Anulación de evento"
        NOTE = "note", "Nota"

    PUBLIC_TYPES = {
        Type.KICKOFF, Type.PERIOD_START, Type.GOAL, Type.PENALTY_GOAL, Type.OWN_GOAL, Type.YELLOW_CARD,
        Type.RED_CARD, Type.SUBSTITUTION, Type.PERIOD_END, Type.MATCH_END, Type.ANNULMENT,
    }
    GOAL_TYPES = {Type.GOAL, Type.PENALTY_GOAL, Type.OWN_GOAL}
    IN_PLAY_TYPES = GOAL_TYPES | {Type.YELLOW_CARD, Type.RED_CARD, Type.SUBSTITUTION}

    match = models.ForeignKey(Match, on_delete=models.PROTECT, related_name="events")
    sequence = models.PositiveIntegerField()
    type = models.CharField(max_length=20, choices=Type.choices)
    period = models.PositiveSmallIntegerField(default=0)
    minute = models.PositiveSmallIntegerField(null=True, blank=True)
    team = models.ForeignKey(TournamentTeam, on_delete=models.PROTECT, null=True, blank=True, related_name="+")
    player = models.ForeignKey(TeamPlayer, on_delete=models.PROTECT, null=True, blank=True, related_name="+")
    player_in = models.ForeignKey(TeamPlayer, on_delete=models.PROTECT, null=True, blank=True, related_name="+")
    annuls = models.OneToOneField("self", on_delete=models.PROTECT, null=True, blank=True,
                                  related_name="annulled_by")
    notes = models.TextField(blank=True)
    is_public = models.BooleanField(default=False)
    recorded_by = models.ForeignKey(User, on_delete=models.PROTECT, related_name="+")

    class Meta:
        ordering = ["match", "sequence"]
        verbose_name = "evento de partido"
        verbose_name_plural = "eventos de partido"
        constraints = [models.UniqueConstraint(fields=["match", "sequence"], name="unique_event_sequence")]


# ---------------------------------------------------------------------------
# Informes, cierre, notas/apelaciones y revisiones
# ---------------------------------------------------------------------------
class ReportRole(models.TextChoices):
    DELEGATE = "delegate", "Delegado"
    REFEREE = "referee", "Árbitro"


class MatchReport(ImmutableModel):
    """Informe oficial. Cada corrección (tras devolución) genera una nueva versión."""

    COMPARABLE = ["home_score", "away_score", "home_yellow", "away_yellow", "home_red", "away_red"]

    match = models.ForeignKey(Match, on_delete=models.PROTECT, related_name="reports")
    role = models.CharField(max_length=10, choices=ReportRole.choices)
    version = models.PositiveSmallIntegerField(default=1)
    home_score = models.PositiveSmallIntegerField()
    away_score = models.PositiveSmallIntegerField()
    home_yellow = models.PositiveSmallIntegerField(default=0)
    away_yellow = models.PositiveSmallIntegerField(default=0)
    home_red = models.PositiveSmallIntegerField(default=0)
    away_red = models.PositiveSmallIntegerField(default=0)
    observations = models.TextField(blank=True)
    attachment = models.FileField(upload_to=UploadTo("reports"), validators=[validate_document_upload], blank=True)
    submitted_by = models.ForeignKey(User, on_delete=models.PROTECT, related_name="+")

    class Meta:
        ordering = ["match", "role", "-version"]
        verbose_name = "informe de partido"
        verbose_name_plural = "informes de partido"
        constraints = [models.UniqueConstraint(fields=["match", "role", "version"], name="unique_report_version")]


class ReportReturn(ImmutableModel):
    """Devolución de un informe por parte de una autoridad (habilita una nueva versión)."""

    report = models.OneToOneField(MatchReport, on_delete=models.PROTECT, related_name="returned")
    reason = models.TextField()
    returned_by = models.ForeignKey(User, on_delete=models.PROTECT, related_name="+")

    class Meta:
        verbose_name = "devolución de informe"
        verbose_name_plural = "devoluciones de informes"


class MatchClosure(ImmutableModel):
    match = models.OneToOneField(Match, on_delete=models.PROTECT, related_name="closure")
    home_score = models.PositiveSmallIntegerField()
    away_score = models.PositiveSmallIntegerField()
    delegate_report = models.ForeignKey(MatchReport, on_delete=models.PROTECT, related_name="+")
    referee_report = models.ForeignKey(MatchReport, on_delete=models.PROTECT, related_name="+")
    notes = models.TextField(blank=True)
    closed_by = models.ForeignKey(User, on_delete=models.PROTECT, related_name="+")

    class Meta:
        verbose_name = "cierre de partido"
        verbose_name_plural = "cierres de partidos"


class MatchNote(ImmutableModel):
    """Notas o apelaciones (casos extraordinarios), incluso tras el cierre."""

    class Kind(models.TextChoices):
        NOTE = "note", "Nota"
        APPEAL = "appeal", "Apelación"

    match = models.ForeignKey(Match, on_delete=models.PROTECT, related_name="notes")
    kind = models.CharField(max_length=10, choices=Kind.choices, default=Kind.NOTE)
    body = models.TextField()
    attachment = models.FileField(upload_to=UploadTo("notes"), validators=[validate_document_upload], blank=True)
    author = models.ForeignKey(User, on_delete=models.PROTECT, related_name="+")

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "nota / apelación"
        verbose_name_plural = "notas y apelaciones"


class ReviewCase(TimeStampedModel):
    """Caso en revisión por autoridades (rechazos de asignación, apelaciones)."""

    class Kind(models.TextChoices):
        REJECTION = "rejection", "Rechazo de asignación"
        APPEAL = "appeal", "Apelación"

    class Status(models.TextChoices):
        OPEN = "open", "Abierto"
        RESOLVED = "resolved", "Resuelto"
        DISMISSED = "dismissed", "Desestimado"

    kind = models.CharField(max_length=10, choices=Kind.choices)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.OPEN, db_index=True)
    match = models.ForeignKey(Match, on_delete=models.PROTECT, related_name="review_cases")
    confirmation = models.ForeignKey(MatchConfirmation, on_delete=models.PROTECT, null=True, blank=True,
                                     related_name="+")
    note = models.ForeignKey(MatchNote, on_delete=models.PROTECT, null=True, blank=True, related_name="+")
    reason = models.TextField()
    raised_by = models.ForeignKey(User, on_delete=models.PROTECT, related_name="+")
    resolution = models.TextField(blank=True)
    resolved_by = models.ForeignKey(User, on_delete=models.PROTECT, null=True, blank=True, related_name="+")
    resolved_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["status", "-created_at"]
        verbose_name = "caso en revisión"
        verbose_name_plural = "casos en revisión"
        permissions = [("resolve_reviewcase", "Puede resolver casos en revisión")]

    def save(self, *args, **kwargs):
        if not self._state.adding:
            previous = ReviewCase.objects.filter(pk=self.pk).values_list("status", flat=True).first()
            if previous and previous != self.Status.OPEN:
                raise ImmutableRecordError("El caso ya fue resuelto y no puede modificarse.")
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise ImmutableRecordError("Los casos en revisión no se eliminan.")
