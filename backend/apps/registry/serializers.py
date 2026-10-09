from django.contrib.auth import get_user_model, password_validation
from django.contrib.auth.models import Group
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from rest_framework import serializers

from apps.accounts import roles
from apps.core.serializers import CleanModelSerializer, IdentityFieldsMixin

from .models import Category, Coach, Delegate, Field, Guardian, Player, Referee, Team

BASE_READONLY = ["id", "is_active", "created_at", "updated_at"]
IDENTITY = ["vat_id", "vat_number", "vat_display", "document_photo"]
PERSON = ["first_name", "last_name", "full_name", "phone", "photo"]
ADDRESS = ["country", "state", "municipality", "address", "full_address"]
ACCOUNT = ["account_mode", "account_user", "account_username", "account_password", "account_email",
           "account_must_change"]


class CategorySerializer(CleanModelSerializer):
    birth_year_limit = serializers.IntegerField(read_only=True)

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


# ---------------------------------------------------------------------------
# Usuario de acceso creado (o vinculado) desde la ficha
# ---------------------------------------------------------------------------
class AccountFieldsMixin(serializers.Serializer):
    """
    Permite crear el usuario de acceso en el mismo formulario de la ficha, o vincular uno existente.

    `account_mode`: "new" crea el usuario con el rol de `account_role`; "existing" vincula `account_user`;
    "none" lo desvincula. Si no se envía, el vínculo no cambia.
    """

    account_role = ""
    account_required_on_create = False

    account_mode = serializers.ChoiceField(choices=["none", "existing", "new"], write_only=True, required=False)
    account_user = serializers.PrimaryKeyRelatedField(queryset=get_user_model().objects.filter(is_active=True),
                                                      write_only=True, required=False, allow_null=True)
    account_username = serializers.CharField(write_only=True, required=False, allow_blank=True, max_length=150)
    account_password = serializers.CharField(write_only=True, required=False, allow_blank=True,
                                             style={"input_type": "password"})
    account_email = serializers.EmailField(write_only=True, required=False, allow_blank=True)
    account_must_change = serializers.BooleanField(write_only=True, required=False, default=True)

    def validate(self, attrs):
        account = {key: attrs.pop(key) for key in ACCOUNT if key in attrs}
        mode = account.get("account_mode")
        if self.instance is None and self.account_required_on_create and mode not in ("new", "existing"):
            raise serializers.ValidationError({"account_mode": "Cree o vincule el usuario de acceso."})
        if mode == "new":
            self._validate_new_account(account, attrs)
        elif mode == "existing" and not account.get("account_user"):
            raise serializers.ValidationError({"account_user": "Seleccione el usuario a vincular."})
        self._account = account
        return super().validate(attrs)

    def _validate_new_account(self, account, attrs):
        User = get_user_model()
        username = (account.get("account_username") or "").strip()
        password = account.get("account_password") or ""
        errors = {}
        if not username:
            errors["account_username"] = "Indique el nombre de usuario."
        elif User.objects.filter(username__iexact=username).exists():
            errors["account_username"] = "Ese nombre de usuario ya existe."
        if not password:
            errors["account_password"] = "Indique la contraseña."
        else:
            probe = User(username=username, email=account.get("account_email", ""),
                         first_name=attrs.get("first_name", ""), last_name=attrs.get("last_name", ""))
            try:
                password_validation.validate_password(password, probe)
            except DjangoValidationError as exc:
                errors["account_password"] = exc.messages
        if errors:
            raise serializers.ValidationError(errors)
        account["account_username"] = username

    def _resolve_account(self, instance_names: dict):
        """Devuelve (modo, usuario) creando el usuario si corresponde."""
        account = getattr(self, "_account", {})
        mode = account.get("account_mode")
        if mode == "existing":
            return mode, account["account_user"]
        if mode != "new":
            return mode, None
        User = get_user_model()
        user = User(username=account["account_username"], email=account.get("account_email", ""),
                    must_change_password=account.get("account_must_change", True), **instance_names)
        user.set_password(account["account_password"])
        user.save()
        group = Group.objects.filter(name=self.account_role).first()
        if group:
            user.groups.add(group)
        return mode, user

    def _names(self, data: dict, instance=None) -> dict:
        get = lambda k: data.get(k, getattr(instance, k, ""))  # noqa: E731
        return {"first_name": (get("first_name") or "")[:150], "last_name": (get("last_name") or "")[:150]}


class PersonAccountMixin(AccountFieldsMixin):
    """Ficha con un único usuario (`user`): delegado, árbitro, entrenador."""

    username = serializers.CharField(source="user.username", read_only=True, default=None)

    def validate(self, attrs):
        attrs = super().validate(attrs)
        user = self._account.get("account_user") if self._account.get("account_mode") == "existing" else None
        if user is not None:
            taken = self.Meta.model.objects.filter(user=user)
            if self.instance is not None:
                taken = taken.exclude(pk=self.instance.pk)
            if taken.exists():
                raise serializers.ValidationError({"account_user": "Ese usuario ya está vinculado a otra ficha."})
        return attrs

    @transaction.atomic
    def create(self, validated_data):
        mode, user = self._resolve_account(self._names(validated_data))
        if user is not None:
            validated_data["user"] = user
        return super().create(validated_data)

    @transaction.atomic
    def update(self, instance, validated_data):
        mode, user = self._resolve_account(self._names(validated_data, instance))
        if mode in ("new", "existing"):
            validated_data["user"] = user
        elif mode == "none":
            validated_data["user"] = None
        return super().update(instance, validated_data)


# ---------------------------------------------------------------------------
# Personas
# ---------------------------------------------------------------------------
class CoachSerializer(PersonAccountMixin, IdentityFieldsMixin, CleanModelSerializer):
    account_role = roles.COACH
    full_name = serializers.CharField(read_only=True)
    license_valid = serializers.BooleanField(read_only=True)
    team_name = serializers.CharField(source="team.name", read_only=True, default=None)

    class Meta:
        model = Coach
        fields = BASE_READONLY + PERSON + IDENTITY + [
            "license_number", "license_photo", "license_expiry_year", "license_valid", "team", "team_name",
            "user", "username",
        ] + ACCOUNT
        read_only_fields = BASE_READONLY + ["user"]


class GuardianSerializer(IdentityFieldsMixin, CleanModelSerializer):
    full_name = serializers.SerializerMethodField()

    class Meta:
        model = Guardian
        fields = BASE_READONLY + ["first_name", "last_name", "full_name", "phone", "relationship"] + IDENTITY
        read_only_fields = BASE_READONLY

    def get_full_name(self, obj):
        return str(obj)


GUARDIAN_INLINE = ["first_name", "last_name", "vat_id", "vat_number", "phone", "relationship"]


class PlayerHistorySerializer(serializers.Serializer):
    """Una inscripción del jugador en un torneo (su paso por un equipo)."""

    id = serializers.IntegerField()
    tournament = serializers.IntegerField(source="registration.tournament_id")
    tournament_name = serializers.CharField(source="registration.tournament.name")
    team = serializers.IntegerField(source="registration.team_id")
    team_name = serializers.CharField(source="registration.team.name")
    category_name = serializers.CharField(source="registration.category.name")
    shirt_number = serializers.IntegerField(allow_null=True)
    is_active = serializers.BooleanField()
    created_at = serializers.DateTimeField()


class PlayerSerializer(IdentityFieldsMixin, CleanModelSerializer):
    full_name = serializers.CharField(read_only=True)
    age = serializers.IntegerField(read_only=True)
    is_minor = serializers.BooleanField(read_only=True)
    guardian_detail = GuardianSerializer(source="guardian", read_only=True)
    current_team_name = serializers.CharField(source="current_team.name", read_only=True, default=None)
    history = serializers.SerializerMethodField()
    stats = serializers.SerializerMethodField()

    # Representante nuevo en el mismo formulario
    guardian_mode = serializers.ChoiceField(choices=["none", "existing", "new"], write_only=True, required=False)
    guardian_first_name = serializers.CharField(write_only=True, required=False, allow_blank=True)
    guardian_last_name = serializers.CharField(write_only=True, required=False, allow_blank=True)
    guardian_vat_id = serializers.CharField(write_only=True, required=False, allow_blank=True)
    guardian_vat_number = serializers.CharField(write_only=True, required=False, allow_blank=True)
    guardian_phone = serializers.CharField(write_only=True, required=False, allow_blank=True)
    guardian_relationship = serializers.CharField(write_only=True, required=False, allow_blank=True)

    class Meta:
        model = Player
        fields = BASE_READONLY + PERSON + IDENTITY + [
            "document_kind", "birth_date", "age", "is_minor", "guardian", "guardian_detail", "current_team",
            "current_team_name", "history", "stats",
        ] + ["guardian_mode"] + [f"guardian_{f}" for f in GUARDIAN_INLINE]
        read_only_fields = BASE_READONLY

    def validate(self, attrs):
        inline = {f: attrs.pop(f"guardian_{f}") for f in GUARDIAN_INLINE if f"guardian_{f}" in attrs}
        mode = attrs.pop("guardian_mode", None)
        if mode == "none":
            attrs["guardian"] = None
        elif mode == "new":
            data = {k: v for k, v in inline.items() if v not in (None, "")}
            data.setdefault("vat_id", "V")
            guardian = GuardianSerializer(data=data)
            if not guardian.is_valid():
                raise serializers.ValidationError({f"guardian_{k}": v for k, v in guardian.errors.items()})
            # Sin guardar todavía: se crea junto al jugador, en la misma transacción.
            attrs["guardian"] = Guardian(**guardian.validated_data)
        return super().validate(attrs)

    def _save_pending_guardian(self, validated_data):
        guardian = validated_data.get("guardian")
        if guardian is not None and guardian.pk is None:
            guardian.save()

    @transaction.atomic
    def create(self, validated_data):
        self._save_pending_guardian(validated_data)
        return super().create(validated_data)

    @transaction.atomic
    def update(self, instance, validated_data):
        self._save_pending_guardian(validated_data)
        return super().update(instance, validated_data)

    def get_history(self, obj):
        entries = sorted(obj.entries.all(), key=lambda e: e.created_at, reverse=True)
        return PlayerHistorySerializer(entries, many=True).data

    def get_stats(self, obj):
        return {
            "goals": getattr(obj, "goals", 0) or 0,
            "yellow_cards": getattr(obj, "yellow_cards", 0) or 0,
            "red_cards": getattr(obj, "red_cards", 0) or 0,
            "matches": getattr(obj, "matches_played", 0) or 0,
            "tournaments": len({e.registration.tournament_id for e in obj.entries.all()}),
            "teams": len({e.registration.team_id for e in obj.entries.all()}),
        }


class OfficialSerializer(PersonAccountMixin, IdentityFieldsMixin, CleanModelSerializer):
    full_name = serializers.CharField(read_only=True)

    class Meta:
        fields = BASE_READONLY + PERSON + IDENTITY + ["license_status", "user", "username"] + ACCOUNT
        read_only_fields = BASE_READONLY + ["user"]


class DelegateSerializer(OfficialSerializer):
    account_role = roles.DELEGATE

    class Meta(OfficialSerializer.Meta):
        model = Delegate


class RefereeSerializer(OfficialSerializer):
    account_role = roles.REFEREE

    class Meta(OfficialSerializer.Meta):
        model = Referee


# ---------------------------------------------------------------------------
# Equipos
# ---------------------------------------------------------------------------
class TeamSerializer(AccountFieldsMixin, IdentityFieldsMixin, CleanModelSerializer):
    account_role = roles.TEAM_MANAGER
    account_required_on_create = True

    full_address = serializers.CharField(read_only=True)
    category_names = serializers.SlugRelatedField(source="categories", many=True, slug_field="name",
                                                  read_only=True)
    coach_names = serializers.SerializerMethodField()
    manager_usernames = serializers.SlugRelatedField(source="managers", many=True, slug_field="username",
                                                     read_only=True)
    manager_details = serializers.SerializerMethodField()
    player_count = serializers.SerializerMethodField()

    class Meta:
        model = Team
        fields = BASE_READONLY + ["name", "logo"] + IDENTITY + ADDRESS + [
            "categories", "category_names", "coach_names", "managers", "manager_usernames", "manager_details",
            "player_count",
        ] + ACCOUNT
        read_only_fields = BASE_READONLY
        extra_kwargs = {"managers": {"required": False}}

    def get_coach_names(self, obj):
        return [c.full_name for c in obj.coaches.all() if c.is_active]

    def get_manager_details(self, obj):
        return [{"id": u.id, "username": u.username, "full_name": u.get_full_name()} for u in obj.managers.all()]

    def get_player_count(self, obj):
        return getattr(obj, "player_count", None) or obj.current_players.filter(is_active=True).count()

    def _attach(self, team, user):
        if user is not None:
            team.managers.add(user)

    @transaction.atomic
    def create(self, validated_data):
        _, user = self._resolve_account({"first_name": validated_data.get("name", "")[:150], "last_name": ""})
        team = super().create(validated_data)
        self._attach(team, user)
        return team

    @transaction.atomic
    def update(self, instance, validated_data):
        _, user = self._resolve_account({"first_name": instance.name[:150], "last_name": ""})
        team = super().update(instance, validated_data)
        self._attach(team, user)
        return team
