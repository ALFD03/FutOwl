from rest_framework import serializers

from apps.core.serializers import CleanModelSerializer

from .models import Group, TeamPlayer, Tournament, TournamentTeam

BASE_READONLY = ["id", "is_active", "created_at", "updated_at"]


class TournamentSerializer(CleanModelSerializer):
    modality_display = serializers.CharField(source="get_modality_display", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    category_names = serializers.SlugRelatedField(source="categories", many=True, slug_field="name", read_only=True)
    field_names = serializers.SlugRelatedField(source="fields", many=True, slug_field="name", read_only=True)
    team_count = serializers.SerializerMethodField()

    class Meta:
        model = Tournament
        fields = BASE_READONLY + [
            "name", "logo", "modality", "modality_display", "status", "status_display", "categories",
            "category_names", "fields", "field_names", "start_date", "end_date", "match_duration_minutes",
            "periods", "break_minutes", "max_substitutions", "max_lineup_players", "starters_count",
            "referees_required", "points_win", "points_draw", "points_loss", "regulation_text",
            "regulation_file", "lineup_sheet_file", "substitution_card_file", "team_count",
        ]
        read_only_fields = BASE_READONLY

    def get_team_count(self, obj):
        return sum(1 for r in obj.registrations.all() if r.is_active)


class GroupSerializer(CleanModelSerializer):
    category_name = serializers.CharField(source="category.name", read_only=True)
    team_ids = serializers.SerializerMethodField()

    class Meta:
        model = Group
        fields = BASE_READONLY + ["tournament", "category", "category_name", "name", "team_ids"]
        read_only_fields = BASE_READONLY

    def get_team_ids(self, obj):
        return [t.id for t in obj.teams.all()]


class TournamentTeamSerializer(CleanModelSerializer):
    tournament_name = serializers.CharField(source="tournament.name", read_only=True)
    tournament_status = serializers.CharField(source="tournament.status", read_only=True)
    roster_count = serializers.SerializerMethodField()
    team_name = serializers.CharField(source="team.name", read_only=True)
    team_logo = serializers.ImageField(source="team.logo", read_only=True)
    category_name = serializers.CharField(source="category.name", read_only=True)
    group_name = serializers.CharField(source="group.name", read_only=True, default=None)

    class Meta:
        model = TournamentTeam
        fields = BASE_READONLY + [
            "tournament", "tournament_name", "tournament_status", "team", "team_name", "team_logo", "category",
            "category_name", "group", "group_name", "roster_count",
        ]
        read_only_fields = BASE_READONLY

    def get_roster_count(self, obj):
        return sum(1 for entry in obj.roster.all() if entry.is_active)


class RosterPlayerSerializer(serializers.Serializer):
    """Datos del jugador que muestra la nómina (sin estadísticas ni historial)."""

    id = serializers.IntegerField()
    full_name = serializers.CharField()
    photo = serializers.ImageField()
    vat_display = serializers.CharField()
    birth_date = serializers.DateField()
    age = serializers.IntegerField()
    is_minor = serializers.BooleanField()
    guardian_name = serializers.SerializerMethodField()

    def get_guardian_name(self, obj):
        return str(obj.guardian) if obj.guardian_id else None


class TeamPlayerSerializer(CleanModelSerializer):
    tournament_name = serializers.CharField(source="tournament.name", read_only=True)
    team = serializers.IntegerField(source="registration.team_id", read_only=True)
    team_name = serializers.CharField(source="registration.team.name", read_only=True)
    category = serializers.IntegerField(source="registration.category_id", read_only=True)
    category_name = serializers.CharField(source="registration.category.name", read_only=True)
    player_detail = RosterPlayerSerializer(source="player", read_only=True)

    class Meta:
        model = TeamPlayer
        fields = BASE_READONLY + [
            "registration", "tournament", "tournament_name", "team", "team_name", "category", "category_name",
            "player", "player_detail", "shirt_number",
        ]
        read_only_fields = BASE_READONLY + ["tournament"]

