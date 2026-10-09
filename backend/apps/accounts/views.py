from django.conf import settings
from django.contrib.auth import authenticate
from django.contrib.auth.models import Group, Permission
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action, api_view, permission_classes, throttle_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import SimpleRateThrottle
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.serializers import TokenRefreshSerializer
from rest_framework_simplejwt.tokens import RefreshToken

from apps.audit.services import record
from apps.core.permissions import ModelActionPermission, require_authenticated

from .models import User
from .serializers import (
    ChangePasswordSerializer,
    GroupSerializer,
    LoginSerializer,
    MeSerializer,
    PermissionSerializer,
    UserSerializer,
)


class LoginThrottle(SimpleRateThrottle):
    """Limita los intentos de inicio de sesión por IP (protección contra fuerza bruta)."""

    scope = "login"

    def get_cache_key(self, request, view):
        return self.cache_format % {"scope": self.scope, "ident": self.get_ident(request)}


def _set_refresh_cookie(response, refresh: str):
    response.set_cookie(
        settings.AUTH_REFRESH_COOKIE,
        refresh,
        max_age=int(settings.SIMPLE_JWT["REFRESH_TOKEN_LIFETIME"].total_seconds()),
        httponly=True,
        secure=settings.AUTH_REFRESH_COOKIE_SECURE,
        samesite=settings.AUTH_REFRESH_COOKIE_SAMESITE,
        path=settings.AUTH_REFRESH_COOKIE_PATH,
    )


def _clear_refresh_cookie(response):
    response.delete_cookie(
        settings.AUTH_REFRESH_COOKIE,
        path=settings.AUTH_REFRESH_COOKIE_PATH,
        samesite=settings.AUTH_REFRESH_COOKIE_SAMESITE,
    )


INVALID_CREDENTIALS = "Credenciales inválidas."


@api_view(["POST"])
@permission_classes([AllowAny])
@throttle_classes([LoginThrottle])
def login_view(request):
    serializer = LoginSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    username = serializer.validated_data["username"]
    candidate = User.objects.filter(username__iexact=username).first()

    if candidate and candidate.is_locked:
        record("login_blocked", candidate, user=candidate)
        return Response(
            {"detail": "Cuenta bloqueada temporalmente por intentos fallidos. Intente más tarde."},
            status=status.HTTP_423_LOCKED,
        )

    user = authenticate(request, username=candidate.username if candidate else username,
                        password=serializer.validated_data["password"])
    if user is None:
        if candidate:
            candidate.register_failed_login()
        record("login_failed", candidate, label=f"usuario={username}")
        return Response({"detail": INVALID_CREDENTIALS}, status=status.HTTP_401_UNAUTHORIZED)

    user.register_successful_login()
    refresh = RefreshToken.for_user(user)
    record("login", user, user=user)
    response = Response({"access": str(refresh.access_token), "user": MeSerializer(user).data})
    _set_refresh_cookie(response, str(refresh))
    return response


@api_view(["POST"])
@permission_classes([AllowAny])
def refresh_view(request):
    token = request.COOKIES.get(settings.AUTH_REFRESH_COOKIE)
    if not token:
        return Response({"detail": "Sesión no iniciada."}, status=status.HTTP_401_UNAUTHORIZED)
    serializer = TokenRefreshSerializer(data={"refresh": token})
    try:
        serializer.is_valid(raise_exception=True)
    except TokenError:
        response = Response({"detail": "Sesión expirada."}, status=status.HTTP_401_UNAUTHORIZED)
        _clear_refresh_cookie(response)
        return response
    except Exception:  # noqa: BLE001 - token inválido / usuario inactivo
        response = Response({"detail": "Sesión inválida."}, status=status.HTTP_401_UNAUTHORIZED)
        _clear_refresh_cookie(response)
        return response
    data = serializer.validated_data
    response = Response({"access": data["access"]})
    if "refresh" in data:
        _set_refresh_cookie(response, data["refresh"])
    return response


@api_view(["POST"])
@permission_classes([AllowAny])
def logout_view(request):
    token = request.COOKIES.get(settings.AUTH_REFRESH_COOKIE)
    if token:
        try:
            refresh = RefreshToken(token)
            record("logout", label=f"user_id={refresh.get('user_id')}")
            refresh.blacklist()
        except TokenError:
            pass
    response = Response(status=status.HTTP_204_NO_CONTENT)
    _clear_refresh_cookie(response)
    return response


@api_view(["GET"])
@permission_classes([IsAuthenticated])
@require_authenticated
def me_view(request):
    return Response(MeSerializer(request.user).data)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
@require_authenticated
def change_password_view(request):
    serializer = ChangePasswordSerializer(data=request.data, context={"request": request})
    serializer.is_valid(raise_exception=True)
    user = request.user
    if not user.check_password(serializer.validated_data["current_password"]):
        return Response({"current_password": ["Contraseña actual incorrecta."]}, status=400)
    user.set_password(serializer.validated_data["new_password"])
    user.must_change_password = False
    user.save(update_fields=["password", "must_change_password"])
    record("password_change", user, user=user)
    return Response({"detail": "Contraseña actualizada."})


class UserViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.CreateModelMixin,
    mixins.UpdateModelMixin,
    viewsets.GenericViewSet,
):
    """Gestión de usuarios (sin borrado: se desactivan)."""

    queryset = User.objects.prefetch_related("groups", "user_permissions")
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated, ModelActionPermission]
    filterset_fields = ["is_active", "groups"]
    search_fields = ["username", "email", "first_name", "last_name"]

    def perform_update(self, serializer):
        before = {
            "groups": sorted(serializer.instance.groups.values_list("name", flat=True)),
            "permissions": serializer.instance.user_permissions.count(),
        }
        user = serializer.save()
        record("update_access", user, changes={
            "antes": before,
            "despues": {
                "groups": sorted(user.groups.values_list("name", flat=True)),
                "permissions": user.user_permissions.count(),
            },
        })

    @action(detail=True, methods=["post"])
    def unlock(self, request, pk=None):
        user = self.get_object()
        user.register_successful_login()
        record("unlock", user)
        return Response({"detail": "Usuario desbloqueado."})


class GroupViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.CreateModelMixin,
    mixins.UpdateModelMixin,
    viewsets.GenericViewSet,
):
    """Roles (grupos de permisos)."""

    queryset = Group.objects.prefetch_related("permissions").order_by("name")
    serializer_class = GroupSerializer
    permission_classes = [IsAuthenticated, ModelActionPermission]
    search_fields = ["name"]

    def perform_create(self, serializer):
        group = serializer.save()
        record("create", group, changes={"permissions": [p.codename for p in group.permissions.all()]})

    def perform_update(self, serializer):
        before = set(serializer.instance.permissions.values_list("codename", flat=True))
        group = serializer.save()
        after = set(group.permissions.values_list("codename", flat=True))
        record("update_permissions", group, changes={
            "agregados": sorted(after - before), "quitados": sorted(before - after)
        })


class PermissionViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Permission.objects.select_related("content_type").filter(
        content_type__app_label__in=[
            "accounts", "auth", "audit", "legal", "notifications", "registry", "tournaments", "competition",
        ]
    ).exclude(content_type__app_label="auth", content_type__model="permission").order_by(
        "content_type__app_label", "content_type__model", "codename"
    )
    serializer_class = PermissionSerializer
    permission_classes = [IsAuthenticated, ModelActionPermission]
    pagination_class = None
    search_fields = ["name", "codename"]
