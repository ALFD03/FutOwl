from django.db.models import Prefetch

from apps.core.mixins import NoDeleteModelViewSet

from . import serializers as s
from .filters import PlayerFilter
from .models import Category, Coach, Delegate, Field, Guardian, Player, Referee, Team, TeamPlayer


class CategoryViewSet(NoDeleteModelViewSet):
    queryset = Category.objects.all()
    serializer_class = s.CategorySerializer
    filterset_fields = ["is_active"]
    search_fields = ["name"]
    ordering_fields = ["name", "birth_year_limit"]


class FieldViewSet(NoDeleteModelViewSet):
    queryset = Field.objects.all()
    serializer_class = s.FieldSerializer
    filterset_fields = ["is_active", "is_divisible", "state"]
    search_fields = ["name", "municipality", "state", "manager_name"]


class CoachViewSet(NoDeleteModelViewSet):
    queryset = Coach.objects.all()
    serializer_class = s.CoachSerializer
    filterset_fields = ["is_active", "teams"]
    search_fields = ["first_name", "last_name", "license_number"]


class GuardianViewSet(NoDeleteModelViewSet):
    queryset = Guardian.objects.all()
    serializer_class = s.GuardianSerializer
    filterset_fields = ["is_active"]
    search_fields = ["first_name", "last_name"]


class PlayerViewSet(NoDeleteModelViewSet):
    queryset = Player.objects.select_related("guardian").prefetch_related(
        Prefetch("memberships", queryset=TeamPlayer.objects.select_related("team", "category"))
    )
    serializer_class = s.PlayerSerializer
    filterset_class = PlayerFilter
    search_fields = ["first_name", "last_name"]
    ordering_fields = ["last_name", "birth_date"]

    def perform_update(self, serializer):
        """Los gestores de equipo solo editan jugadores de sus nóminas (o sin equipo)."""
        from rest_framework.exceptions import PermissionDenied

        user = self.request.user
        player = serializer.instance
        if not (user.is_superuser or user.has_perm("registry.change_team")):
            teams = {m.team_id for m in player.memberships.all() if m.is_active}
            if teams and not user.managed_teams.filter(pk__in=teams).exists():
                raise PermissionDenied("Solo puede editar jugadores de sus equipos.")
        serializer.save()


class DelegateViewSet(NoDeleteModelViewSet):
    queryset = Delegate.objects.select_related("user")
    serializer_class = s.DelegateSerializer
    filterset_fields = ["is_active", "license_status"]
    search_fields = ["first_name", "last_name"]


class RefereeViewSet(NoDeleteModelViewSet):
    queryset = Referee.objects.select_related("user")
    serializer_class = s.RefereeSerializer
    filterset_fields = ["is_active", "license_status"]
    search_fields = ["first_name", "last_name"]


class TeamViewSet(NoDeleteModelViewSet):
    queryset = Team.objects.select_related("home_field").prefetch_related("categories", "coaches", "roster")
    serializer_class = s.TeamSerializer
    filterset_fields = ["is_active", "categories", "home_field"]
    search_fields = ["name", "municipality", "state"]

    def get_queryset(self):
        qs = super().get_queryset()
        if self.request.query_params.get("mine") == "1":
            qs = qs.filter(managers=self.request.user)
        return qs


class TeamPlayerViewSet(NoDeleteModelViewSet):
    """Nómina por equipo y categoría. Los gestores solo administran la de sus equipos."""

    queryset = TeamPlayer.objects.select_related("team", "category", "player", "player__guardian")
    serializer_class = s.TeamPlayerSerializer
    filterset_fields = ["team", "category", "player", "is_active"]
    search_fields = ["player__first_name", "player__last_name"]

    def _assert_can_manage(self, team):
        from rest_framework.exceptions import PermissionDenied

        user = self.request.user
        if user.is_superuser or user.has_perm("registry.change_team"):
            return
        if not team.managers.filter(pk=user.pk).exists():
            raise PermissionDenied("Solo puede gestionar la nómina de sus equipos.")

    def perform_create(self, serializer):
        self._assert_can_manage(serializer.validated_data["team"])
        super().perform_create(serializer)

    def perform_update(self, serializer):
        self._assert_can_manage(serializer.instance.team)
        serializer.save()
