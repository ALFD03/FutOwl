from django.contrib.auth import password_validation
from django.contrib.auth.models import Group, Permission
from rest_framework import serializers

from .models import User


DEFAULT_ACTIONS = {"add": "Crear", "change": "Editar", "delete": "Eliminar", "view": "Ver"}
# En FutOwl los grupos de Django son los roles.
MODEL_NAMES = {("auth", "group"): "roles"}


def model_name_plural(permission: Permission) -> str | None:
    ct = permission.content_type
    model = ct.model_class()
    if (ct.app_label, ct.model) in MODEL_NAMES:
        return MODEL_NAMES[(ct.app_label, ct.model)]
    return str(model._meta.verbose_name_plural) if model else None


def permission_label(permission: Permission) -> str:
    """
    Nombre en español. Los permisos estándar de Django se guardan en inglés ("Can add equipo"),
    así que se arman con el verbo y el nombre del modelo; los propios ya vienen en español.
    """
    action, _, model_name = permission.codename.partition("_")
    plural = model_name_plural(permission)
    if action in DEFAULT_ACTIONS and plural and model_name == permission.content_type.model:
        return f"{DEFAULT_ACTIONS[action]} {plural}"
    name = permission.name
    return name[len("Puede "):].capitalize() if name.startswith("Puede ") else name


class PermissionSerializer(serializers.ModelSerializer):
    code = serializers.SerializerMethodField()
    label = serializers.SerializerMethodField()
    app_label = serializers.CharField(source="content_type.app_label", read_only=True)
    model = serializers.CharField(source="content_type.model", read_only=True)
    model_label = serializers.SerializerMethodField()

    class Meta:
        model = Permission
        fields = ["id", "name", "label", "codename", "code", "app_label", "model", "model_label"]

    def get_code(self, obj):
        return f"{obj.content_type.app_label}.{obj.codename}"

    def get_label(self, obj):
        return permission_label(obj)

    def get_model_label(self, obj):
        return (model_name_plural(obj) or obj.content_type.model).capitalize()


class GroupSerializer(serializers.ModelSerializer):
    permissions = serializers.PrimaryKeyRelatedField(many=True, queryset=Permission.objects.all(), required=False)
    user_count = serializers.IntegerField(source="user_set.count", read_only=True)

    class Meta:
        model = Group
        fields = ["id", "name", "permissions", "user_count"]


class UserSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=False, style={"input_type": "password"})
    groups = serializers.PrimaryKeyRelatedField(many=True, queryset=Group.objects.all(), required=False)
    user_permissions = serializers.PrimaryKeyRelatedField(
        many=True, queryset=Permission.objects.all(), required=False
    )

    class Meta:
        model = User
        fields = [
            "id", "username", "email", "first_name", "last_name", "phone", "is_active", "is_staff",
            "groups", "user_permissions", "password", "last_login", "date_joined", "must_change_password",
        ]
        read_only_fields = ["is_staff", "last_login", "date_joined"]

    def validate_password(self, value):
        password_validation.validate_password(value)
        return value

    def create(self, validated_data):
        password = validated_data.pop("password", None)
        if not password:
            raise serializers.ValidationError({"password": "La contraseña es obligatoria."})
        groups = validated_data.pop("groups", [])
        perms = validated_data.pop("user_permissions", [])
        user = User(**validated_data)
        user.set_password(password)
        user.save()
        user.groups.set(groups)
        user.user_permissions.set(perms)
        return user

    def update(self, instance, validated_data):
        password = validated_data.pop("password", None)
        user = super().update(instance, validated_data)
        if password:
            user.set_password(password)
            user.save(update_fields=["password"])
        return user


class MeSerializer(serializers.ModelSerializer):
    permissions = serializers.SerializerMethodField()
    groups = serializers.SlugRelatedField(many=True, slug_field="name", read_only=True)
    profiles = serializers.SerializerMethodField()
    terms_accepted = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id", "username", "email", "first_name", "last_name", "is_superuser", "groups",
            "permissions", "profiles", "terms_accepted", "must_change_password",
        ]

    def get_permissions(self, obj):
        return sorted(obj.get_all_permissions())

    def get_profiles(self, obj):
        delegate = getattr(obj, "delegate_profile", None)
        referee = getattr(obj, "referee_profile", None)
        coach = getattr(obj, "coach_profile", None)
        team_ids = set(obj.managed_teams.values_list("id", flat=True))
        if coach and coach.is_active and coach.team_id:
            team_ids.add(coach.team_id)
        return {
            "delegate_id": delegate.id if delegate else None,
            "referee_id": referee.id if referee else None,
            "coach_id": coach.id if coach else None,
            "team_ids": sorted(team_ids),
        }

    def get_terms_accepted(self, obj):
        from apps.legal.services import has_accepted_current_terms

        return has_accepted_current_terms(obj)


class LoginSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=150)
    password = serializers.CharField(max_length=128, style={"input_type": "password"})


class ChangePasswordSerializer(serializers.Serializer):
    current_password = serializers.CharField()
    new_password = serializers.CharField()

    def validate_new_password(self, value):
        password_validation.validate_password(value, self.context["request"].user)
        return value
