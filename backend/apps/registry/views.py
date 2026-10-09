from django.db.models import Count, IntegerField, OuterRef, Prefetch, Q, Subquery, Value
from django.db.models.functions import Coalesce
from rest_framework.exceptions import PermissionDenied

from apps.core.mixins import NoDeleteModelViewSet

from . import serializers as s
from .filters import CoachFilter, PlayerFilter
from .models import Category, Coach, Delegate, Field, Guardian, Player, Referee, Team


def is_registry_admin(user) -> bool:
    """Administra cualquier equipo (no solo los propios)."""
    return user.is_superuser or user.has_perm("registry.change_team")


def _count(queryset, group_by: str, distinct: str = "id"):
    """Subconsulta escalar con un conteo por jugador (0 si no hay filas)."""
    sub = queryset.values(group_by).annotate(n=Count(distinct, distinct=True)).values("n")
    return Coalesce(Subquery(sub, output_field=IntegerField()), Value(0))


def player_stats_annotations() -> dict:
    from apps.competition.models import LineupPlayer, Match, MatchEvent

    played = [Match.Status.IN_PROGRESS, Match.Status.FINISHED, Match.Status.CLOSED]
    T = MatchEvent.Type
    events = MatchEvent.objects.filter(player__player=OuterRef("pk"), annulled_by__isnull=True,
                                       match__status__in=played)
    return {
        "goals": _count(events.filter(type__in=[T.GOAL, T.PENALTY_GOAL]), "player__player"),
        "yellow_cards": _count(events.filter(type=T.YELLOW_CARD), "player__player"),
        "red_cards": _count(events.filter(type=T.RED_CARD), "player__player"),
        "matches_played": _count(
            LineupPlayer.objects.filter(team_player__player=OuterRef("pk"), lineup__match__status__in=played),
            "team_player__player", "lineup__match",
        ),
    }


class CategoryViewSet(NoDeleteModelViewSet):
    queryset = Category.objects.all()
    serializer_class = s.CategorySerializer
    filterset_fields = ["is_active"]
    search_fields = ["name"]
    ordering_fields = ["name", "max_age"]


class FieldViewSet(NoDeleteModelViewSet):
    queryset = Field.objects.all()
    serializer_class = s.FieldSerializer
    filterset_fields = ["is_active", "is_divisible", "state"]
    search_fields = ["name", "municipality", "state", "manager_name"]


class CoachViewSet(NoDeleteModelViewSet):
    queryset = Coach.objects.select_related("team", "user")
    serializer_class = s.CoachSerializer
    filterset_class = CoachFilter
    search_fields = ["first_name", "last_name", "license_number"]

    def _check_team_change(self, serializer):
        """Los gestores solo asignan entrenadores libres a su equipo, o liberan los suyos."""
        user = self.request.user
        if is_registry_admin(user) or "team" not in serializer.validated_data:
            return
        new_team = serializer.validated_data["team"]
        current = serializer.instance.team if serializer.instance else None
        if current is not None and not current.is_staff_user(user):
            raise PermissionDenied("El entrenador pertenece a otro equipo.")
        if new_team is not None and not new_team.is_staff_user(user):
            raise PermissionDenied("Solo puede asignar entrenadores a sus equipos.")

    def perform_create(self, serializer):
        self._check_team_change(serializer)
        super().perform_create(serializer)

    def perform_update(self, serializer):
        self._check_team_change(serializer)
        serializer.save()


class GuardianViewSet(NoDeleteModelViewSet):
    queryset = Guardian.objects.all()
    serializer_class = s.GuardianSerializer
    filterset_fields = ["is_active"]
    search_fields = ["first_name", "last_name"]


class PlayerViewSet(NoDeleteModelViewSet):
    serializer_class = s.PlayerSerializer
    filterset_class = PlayerFilter
    search_fields = ["first_name", "last_name"]
    ordering_fields = ["last_name", "birth_date", "goals"]
    queryset = Player.objects.all()

    def get_queryset(self):
        from apps.tournaments.models import TeamPlayer

        entries = TeamPlayer.objects.select_related(
            "registration__team", "registration__tournament", "registration__category"
        )
        return (
            Player.objects.select_related("guardian", "current_team")
            .prefetch_related(Prefetch("entries", queryset=entries))
            .annotate(**player_stats_annotations())
        )

    def _check_current_team(self, serializer):
        user = self.request.user
        if is_registry_admin(user) or "current_team" not in serializer.validated_data:
            return
        team = serializer.validated_data["current_team"]
        if serializer.instance is not None and team != serializer.instance.current_team:
            raise PermissionDenied("El equipo actual cambia al inscribir al jugador en un torneo.")
        if team is not None and not team.is_staff_user(user):
            raise PermissionDenied("Solo puede registrar jugadores para sus equipos.")

    def perform_create(self, serializer):
        self._check_current_team(serializer)
        super().perform_create(serializer)

    def perform_update(self, serializer):
        """La ficha la actualiza el equipo actual del jugador (o un administrador)."""
        user = self.request.user
        team = serializer.instance.current_team
        if not is_registry_admin(user) and team is not None and not team.is_staff_user(user):
            raise PermissionDenied(f"Solo el equipo actual del jugador ({team.name}) puede actualizar su ficha.")
        self._check_current_team(serializer)
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
    queryset = Team.objects.prefetch_related("categories", "coaches", "managers").annotate(
        player_count=Count("current_players", filter=Q(current_players__is_active=True), distinct=True)
    )
    serializer_class = s.TeamSerializer
    filterset_fields = ["is_active", "categories"]
    search_fields = ["name", "municipality", "state"]

    def get_queryset(self):
        qs = super().get_queryset()
        if self.request.query_params.get("mine") == "1":
            user = self.request.user
            qs = qs.filter(Q(managers=user) | Q(coaches__user=user)).distinct()
        return qs
