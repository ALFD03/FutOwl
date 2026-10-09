from rest_framework import serializers

from apps.core.serializers import CleanModelSerializer, IdentityFieldsMixin

from .models import Category, Coach, Delegate, Field, Guardian, Player, Referee, Team, TeamPlayer

BASE_READONLY = ["id", "is_active", "created_at", "updated_at"]
IDENTITY = ["vat_id", "vat_number", "vat_display", "document_photo"]
PERSON = ["first_name", "last_name", "full_name", "phone", "photo"]
ADDRESS = ["country", "state", "municipality", "address", "full_address"]


class CategorySerializer(CleanModelSerializer):
    class Meta:
        model = Category
        fields = BASE_READONLY + ["name", "max_age", "birth_year_limit"]
        read_only_fields = BASE_READONLY


class FieldSerializer(CleanModelSerializer):
    capacity = serializers.IntegerField(read_only=True)
    full_address = serializers.CharField(read_only=True)

    class Meta:
        model = Field
        fields = BASE_READONLY + ["name"] + ADDRESS + [
            "manager_name", "manager_phone", "length_m", "width_m", "is_divisible", "mini_fields_count", "capacity",
        ]
        read_only_fields = BASE_READONLY


class CoachSerializer(IdentityFieldsMixin, CleanModelSerializer):
    full_name = serializers.CharField(read_only=True)
    license_valid = serializers.BooleanField(read_only=True)

    class Meta:
        model = Coach
        fields = BASE_READONLY + PERSON + IDENTITY + [
            "license_number", "license_photo", "license_expiry_year", "license_valid",
        ]
        read_only_fields = BASE_READONLY


class GuardianSerializer(IdentityFieldsMixin, CleanModelSerializer):
    class Meta:
        model = Guardian
        fields = BASE_READONLY + ["first_name", "last_name", "phone", "relationship"] + IDENTITY
        read_only_fields = BASE_READONLY


class MembershipSummarySerializer(serializers.ModelSerializer):
    team_name = serializers.CharField(source="team.name", read_only=True)
    category_name = serializers.CharField(source="category.name", read_only=True)

    class Meta:
        model = TeamPlayer
        fields = ["id", "team", "team_name", "category", "category_name", "shirt_number", "is_active"]


class PlayerSerializer(IdentityFieldsMixin, CleanModelSerializer):
    full_name = serializers.CharField(read_only=True)
    age = serializers.IntegerField(read_only=True)
    is_minor = serializers.BooleanField(read_only=True)
    guardian_detail = GuardianSerializer(source="guardian", read_only=True)
    memberships = serializers.SerializerMethodField()

    class Meta:
        model = Player
        fields = BASE_READONLY + PERSON + IDENTITY + [
            "document_kind", "birth_date", "age", "is_minor", "guardian", "guardian_detail", "memberships",
        ]
        read_only_fields = BASE_READONLY

    def get_memberships(self, obj):
        active = [m for m in obj.memberships.all() if m.is_active]
        return MembershipSummarySerializer(active, many=True).data


class OfficialSerializer(IdentityFieldsMixin, CleanModelSerializer):
    full_name = serializers.CharField(read_only=True)
    username = serializers.CharField(source="user.username", read_only=True, default=None)

    class Meta:
        fields = BASE_READONLY + PERSON + IDENTITY + ["license_status", "user", "username"]
        read_only_fields = BASE_READONLY


class DelegateSerializer(OfficialSerializer):
    class Meta(OfficialSerializer.Meta):
        model = Delegate


class RefereeSerializer(OfficialSerializer):
    class Meta(OfficialSerializer.Meta):
        model = Referee


class TeamPlayerSerializer(CleanModelSerializer):
    player_detail = PlayerSerializer(source="player", read_only=True)
    category_name = serializers.CharField(source="category.name", read_only=True)
    team_name = serializers.CharField(source="team.name", read_only=True)

    class Meta:
        model = TeamPlayer
        fields = BASE_READONLY + [
            "team", "team_name", "player", "player_detail", "category", "category_name", "shirt_number",
        ]
        read_only_fields = BASE_READONLY


class TeamSerializer(IdentityFieldsMixin, CleanModelSerializer):
    full_address = serializers.CharField(read_only=True)
    category_names = serializers.SlugRelatedField(source="categories", many=True, slug_field="name",
                                                  read_only=True)
    home_field_name = serializers.CharField(source="home_field.name", read_only=True, default=None)
    coach_names = serializers.SerializerMethodField()
    roster_count = serializers.SerializerMethodField()

    class Meta:
        model = Team
        fields = BASE_READONLY + ["name", "logo"] + IDENTITY + ADDRESS + [
            "categories", "category_names", "home_field", "home_field_name", "coaches", "coach_names",
            "managers", "roster_count",
        ]
        read_only_fields = BASE_READONLY

    def get_coach_names(self, obj):
        return [c.full_name for c in obj.coaches.all()]

    def get_roster_count(self, obj):
        return sum(1 for m in obj.roster.all() if m.is_active)
