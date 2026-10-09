from datetime import timedelta

from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from apps.core.serializers import CleanModelSerializer
from apps.registry.models import Coach, Delegate, Field, Referee

from .models import (
    Lineup,
    LineupPlayer,
    Match,
    MatchAdjustment,
    MatchConfirmation,
    Matchday,
    MatchEvent,
    MatchNote,
    MatchReport,
    Party,
    ReportRole,
    ReviewCase,
)
from .services import scheduling


def _name(obj):
    return str(obj) if obj else None


class MatchdaySerializer(serializers.ModelSerializer):
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    tournament_name = serializers.CharField(source="tournament.name", read_only=True)
    match_count = serializers.SerializerMethodField()

    class Meta:
        model = Matchday
        fields = [
            "id", "tournament", "tournament_name", "number", "name", "date", "status", "status_display",
            "submitted_at", "confirmed_at", "closed_at", "match_count", "created_at",
        ]
        read_only_fields = ["status", "submitted_at", "confirmed_at", "closed_at", "created_at"]

    def get_match_count(self, obj):
        return len(obj.matches.all())

    def validate(self, attrs):
        if self.instance and self.instance.status != Matchday.Status.DRAFT:
            raise serializers.ValidationError("La jornada ya fue enviada y no puede editarse.")
        return attrs


class MatchSerializer(serializers.ModelSerializer):
    """Lectura de partidos (listados y detalle)."""

    tournament_name = serializers.CharField(source="tournament.name", read_only=True)
    category_name = serializers.CharField(source="category.name", read_only=True)
    group_name = serializers.CharField(source="group.name", read_only=True, default=None)
    home_name = serializers.CharField(source="home.team.name", read_only=True)
    away_name = serializers.CharField(source="away.team.name", read_only=True)
    home_team_id = serializers.IntegerField(source="home.team_id", read_only=True)
    away_team_id = serializers.IntegerField(source="away.team_id", read_only=True)
    home_logo = serializers.ImageField(source="home.team.logo", read_only=True)
    away_logo = serializers.ImageField(source="away.team.logo", read_only=True)
    matchday_label = serializers.SerializerMethodField()
    field_name = serializers.CharField(source="field.name", read_only=True, default=None)
    delegate_name = serializers.SerializerMethodField()
    referee_name = serializers.SerializerMethodField()
    assistant_referee_1_name = serializers.SerializerMethodField()
    assistant_referee_2_name = serializers.SerializerMethodField()
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    phase_display = serializers.CharField(source="get_phase_display", read_only=True)
    is_locked = serializers.BooleanField(read_only=True)
    missing_fields = serializers.SerializerMethodField()

    class Meta:
        model = Match
        fields = [
            "id", "tournament", "tournament_name", "category", "category_name", "group", "group_name",
            "round_number", "home", "home_name", "home_team_id", "home_logo", "away", "away_name", "away_team_id",
            "away_logo", "matchday",
            "matchday_label", "field", "field_name", "sub_field", "scheduled_start", "scheduled_end", "delegate",
            "delegate_name", "referee", "referee_name", "assistant_referee_1", "assistant_referee_1_name",
            "assistant_referee_2", "assistant_referee_2_name", "status", "status_display", "phase",
            "phase_display", "current_period", "period_started_at", "assignment_version", "home_score",
            "away_score", "is_locked", "missing_fields", "created_at", "updated_at",
        ]
        read_only_fields = fields

    def get_matchday_label(self, obj):
        return _name(obj.matchday)

    def get_delegate_name(self, obj):
        return _name(obj.delegate)

    def get_referee_name(self, obj):
        return _name(obj.referee)

    def get_assistant_referee_1_name(self, obj):
        return _name(obj.assistant_referee_1)

    def get_assistant_referee_2_name(self, obj):
        return _name(obj.assistant_referee_2)

    def get_missing_fields(self, obj):
        return scheduling.missing_fields(obj) if obj.status == Match.Status.DRAFT else []


class MatchWriteSerializer(CleanModelSerializer):
    """Creación/edición de partidos en borrador (los enviados se modifican con ajustes)."""

    class Meta:
        model = Match
        fields = [
            "id", "tournament", "category", "group", "round_number", "home", "away", "matchday", "field",
            "sub_field", "scheduled_start", "scheduled_end", "delegate", "referee", "assistant_referee_1",
            "assistant_referee_2",
        ]

    def validate(self, attrs):
        if self.instance is not None and self.instance.is_locked:
            raise serializers.ValidationError(
                "El partido ya fue enviado: use un ajuste con exposición de motivos."
            )
        matchday = attrs.get("matchday", getattr(self.instance, "matchday", None))
        if matchday is not None and matchday.status != Matchday.Status.DRAFT:
            raise serializers.ValidationError({"matchday": "La jornada ya fue enviada."})
        start = attrs.get("scheduled_start", getattr(self.instance, "scheduled_start", None))
        start_changed = "scheduled_start" in attrs
        if start and not attrs.get("scheduled_end") and (start_changed or not getattr(self.instance, "scheduled_end", None)):
            tournament = attrs.get("tournament") or self.instance.tournament
            attrs["scheduled_end"] = start + timedelta(
                minutes=tournament.match_duration_minutes + tournament.break_minutes * (tournament.periods - 1)
            )
        attrs = super().validate(attrs)
        probe = Match(**{**self._current_values(), **attrs})
        probe.pk = getattr(self.instance, "pk", None)
        try:
            scheduling.validate_schedule(probe)
        except DjangoValidationError as exc:
            raise serializers.ValidationError(exc.message_dict)
        attrs["sub_field"] = probe.sub_field
        return attrs

    def _current_values(self):
        if self.instance is None:
            return {}
        return {f: getattr(self.instance, f) for f in self.Meta.fields if f != "id"}


class MatchAdjustSerializer(serializers.Serializer):
    reason = serializers.CharField(min_length=10)
    field = serializers.PrimaryKeyRelatedField(queryset=Field.objects.filter(is_active=True), required=False)
    sub_field = serializers.IntegerField(required=False, allow_null=True)
    scheduled_start = serializers.DateTimeField(required=False)
    scheduled_end = serializers.DateTimeField(required=False)
    delegate = serializers.PrimaryKeyRelatedField(queryset=Delegate.objects.filter(is_active=True), required=False)
    referee = serializers.PrimaryKeyRelatedField(queryset=Referee.objects.filter(is_active=True), required=False)
    assistant_referee_1 = serializers.PrimaryKeyRelatedField(
        queryset=Referee.objects.filter(is_active=True), required=False, allow_null=True)
    assistant_referee_2 = serializers.PrimaryKeyRelatedField(
        queryset=Referee.objects.filter(is_active=True), required=False, allow_null=True)


class MatchConfirmationSerializer(serializers.ModelSerializer):
    party_display = serializers.CharField(source="get_party_display", read_only=True)
    response_display = serializers.CharField(source="get_response_display", read_only=True)
    username = serializers.CharField(source="user.username", read_only=True)

    class Meta:
        model = MatchConfirmation
        fields = ["id", "match", "assignment_version", "party", "party_display", "response", "response_display",
                  "reason", "username", "created_at"]
        read_only_fields = fields


class RespondSerializer(serializers.Serializer):
    party = serializers.ChoiceField(choices=Party.choices)
    response = serializers.ChoiceField(choices=MatchConfirmation.Response.choices)
    reason = serializers.CharField(required=False, allow_blank=True, max_length=2000)


class MatchAdjustmentSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source="user.username", read_only=True)

    class Meta:
        model = MatchAdjustment
        fields = ["id", "match", "version_from", "version_to", "changes", "affected_parties", "reason", "username",
                  "created_at"]
        read_only_fields = fields


class LineupPlayerSerializer(serializers.ModelSerializer):
    player_name = serializers.SerializerMethodField()
    player_photo = serializers.ImageField(source="team_player.player.photo", read_only=True)

    class Meta:
        model = LineupPlayer
        fields = ["id", "team_player", "player_name", "player_photo", "shirt_number", "is_starter", "is_captain"]

    def get_player_name(self, obj):
        return obj.team_player.player.full_name


class LineupSerializer(serializers.ModelSerializer):
    players = LineupPlayerSerializer(many=True, read_only=True)
    team_name = serializers.CharField(source="team.team.name", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    coach_name = serializers.SerializerMethodField()

    class Meta:
        model = Lineup
        fields = ["id", "match", "team", "team_name", "status", "status_display", "coach", "coach_name",
                  "sheet_file", "players", "verified_at", "created_at", "updated_at"]
        read_only_fields = fields

    def get_coach_name(self, obj):
        return _name(obj.coach)


class LineupPlayerInputSerializer(serializers.Serializer):
    team_player = serializers.IntegerField()
    shirt_number = serializers.IntegerField(min_value=0, max_value=99)
    is_starter = serializers.BooleanField(default=False)
    is_captain = serializers.BooleanField(default=False)


class SubmitLineupSerializer(serializers.Serializer):
    team = serializers.IntegerField()
    players = LineupPlayerInputSerializer(many=True)
    coach = serializers.PrimaryKeyRelatedField(queryset=Coach.objects.filter(is_active=True), required=False,
                                               allow_null=True)
    sheet_file = serializers.FileField(required=False, allow_null=True)


class MatchEventSerializer(serializers.ModelSerializer):
    type_display = serializers.CharField(source="get_type_display", read_only=True)
    team_name = serializers.CharField(source="team.team.name", read_only=True, default=None)
    player_name = serializers.SerializerMethodField()
    player_in_name = serializers.SerializerMethodField()
    recorded_by_name = serializers.CharField(source="recorded_by.username", read_only=True)
    annulled = serializers.SerializerMethodField()

    class Meta:
        model = MatchEvent
        fields = ["id", "match", "sequence", "type", "type_display", "period", "minute", "team", "team_name",
                  "player", "player_name", "player_in", "player_in_name", "annuls", "annulled", "notes",
                  "is_public", "recorded_by_name", "created_at"]
        read_only_fields = fields

    def get_player_name(self, obj):
        return obj.player.player.full_name if obj.player_id else None

    def get_player_in_name(self, obj):
        return obj.player_in.player.full_name if obj.player_in_id else None

    def get_annulled(self, obj):
        return hasattr(obj, "annulled_by")


class PublicMatchEventSerializer(MatchEventSerializer):
    class Meta(MatchEventSerializer.Meta):
        fields = ["id", "sequence", "type", "type_display", "period", "minute", "team", "team_name", "player_name",
                  "player_in_name", "annuls", "annulled", "created_at"]


class RecordEventSerializer(serializers.Serializer):
    type = serializers.ChoiceField(choices=MatchEvent.Type.choices)
    team = serializers.IntegerField(required=False, allow_null=True)
    player = serializers.IntegerField(required=False, allow_null=True)
    player_in = serializers.IntegerField(required=False, allow_null=True)
    minute = serializers.IntegerField(required=False, allow_null=True, min_value=0, max_value=200)
    annuls = serializers.PrimaryKeyRelatedField(queryset=MatchEvent.objects.all(), required=False, allow_null=True)
    notes = serializers.CharField(required=False, allow_blank=True, max_length=2000)

    def to_service(self) -> dict:
        d = self.validated_data
        return {"type": d["type"], "team_id": d.get("team"), "player_id": d.get("player"),
                "player_in_id": d.get("player_in"), "minute": d.get("minute"), "annuls": d.get("annuls"),
                "notes": d.get("notes", "")}


class MatchReportSerializer(serializers.ModelSerializer):
    role_display = serializers.CharField(source="get_role_display", read_only=True)
    submitted_by_name = serializers.CharField(source="submitted_by.username", read_only=True)
    returned = serializers.SerializerMethodField()

    class Meta:
        model = MatchReport
        fields = ["id", "match", "role", "role_display", "version", "home_score", "away_score", "home_yellow",
                  "away_yellow", "home_red", "away_red", "observations", "attachment", "submitted_by_name",
                  "returned", "created_at"]
        read_only_fields = ["id", "match", "version", "submitted_by_name", "returned", "created_at"]

    def get_returned(self, obj):
        ret = getattr(obj, "returned", None)
        return {"reason": ret.reason, "by": ret.returned_by.username, "at": ret.created_at} if ret else None


class SubmitReportSerializer(serializers.Serializer):
    role = serializers.ChoiceField(choices=ReportRole.choices)
    home_score = serializers.IntegerField(min_value=0)
    away_score = serializers.IntegerField(min_value=0)
    home_yellow = serializers.IntegerField(min_value=0, default=0)
    away_yellow = serializers.IntegerField(min_value=0, default=0)
    home_red = serializers.IntegerField(min_value=0, default=0)
    away_red = serializers.IntegerField(min_value=0, default=0)
    observations = serializers.CharField(required=False, allow_blank=True)
    attachment = serializers.FileField(required=False, allow_null=True)


class MatchNoteSerializer(serializers.ModelSerializer):
    author_name = serializers.CharField(source="author.username", read_only=True)
    kind_display = serializers.CharField(source="get_kind_display", read_only=True)

    class Meta:
        model = MatchNote
        fields = ["id", "match", "kind", "kind_display", "body", "attachment", "author_name", "created_at"]
        read_only_fields = ["id", "match", "author_name", "created_at"]


class ReviewCaseSerializer(serializers.ModelSerializer):
    kind_display = serializers.CharField(source="get_kind_display", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    match_label = serializers.CharField(source="match.__str__", read_only=True)
    raised_by_name = serializers.CharField(source="raised_by.username", read_only=True)
    resolved_by_name = serializers.CharField(source="resolved_by.username", read_only=True, default=None)
    party = serializers.CharField(source="confirmation.party", read_only=True, default=None)

    class Meta:
        model = ReviewCase
        fields = ["id", "kind", "kind_display", "status", "status_display", "match", "match_label", "party",
                  "reason", "raised_by_name", "resolution", "resolved_by_name", "resolved_at", "created_at"]
        read_only_fields = fields


class ResolveCaseSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=[ReviewCase.Status.RESOLVED, ReviewCase.Status.DISMISSED])
    resolution = serializers.CharField(min_length=5)
