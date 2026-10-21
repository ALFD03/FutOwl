from django.db.models import Case, Count, IntegerField, OuterRef, Prefetch, Q, Subquery, Value, When
from django.db.models.functions import Coalesce
from django.shortcuts import get_object_or_404
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response

from apps.audit.services import record
from apps.core.mixins import NoDeleteModelViewSet

from . import serializers as s
from .filters import CoachFilter, PlayerFilter
from .models import Category, Coach, Delegate, Field, Guardian, Player, Referee, Team


def is_registry_admin(user) -> bool:
    """Administra cualquier equipo (no solo los propios)."""
    return user.is_superuser or user.has_perm("registry.change_team")


def own_team_ids(user) -> set[int]:
    """Equipos que el usuario administra como gestor o a los que pertenece como entrenador."""
    ids = set(user.managed_teams.values_list("id", flat=True))
    coach = getattr(user, "coach_profile", None)
    if coach and coach.is_active and coach.team_id:
        ids.add(coach.team_id)
    return ids


def assert_team_owned(user, team, obj, what: str):
    """
    Gestores y entrenadores solo modifican lo de su equipo. Un registro sin equipo solo lo modifica
    quien lo creó (p. ej. recién registrado y aún sin asignar). Los administradores del registro, todo.
    """
    if is_registry_admin(user):
        return
    if team is not None:
        if not team.is_staff_user(user):
            raise PermissionDenied(f"Solo el equipo {team.name} puede modificar {what}.")
    elif getattr(obj, "created_by_id", None) != user.pk:
        raise PermissionDenied(f"Solo puede modificar {what} de su equipo.")


def assert_no_foreign_account(user, serializer):
    """Vincular un usuario existente (distinto del ya vinculado) queda reservado a los administradores."""
    data = serializer.initial_data
    if data.get("account_mode") != "existing" or is_registry_admin(user):
        return
    current = getattr(serializer.instance, "user_id", None)
    if current is None or str(data.get("account_user")) != str(current):
        raise PermissionDenied("Solo un administrador puede vincular un usuario existente; cree uno nuevo.")


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

    def assert_can_write(self, instance):
        assert_team_owned(self.request.user, instance.team, instance, "a este entrenador")

    def perform_create(self, serializer):
        assert_no_foreign_account(self.request.user, serializer)
        self._check_team_change(serializer)
        super().perform_create(serializer)

    def perform_update(self, serializer):
        """Los datos del entrenador los edita su equipo; un entrenador libre se puede asignar al equipo propio."""
        user = self.request.user
        coach = serializer.instance
        assigning_free = coach.team is None and serializer.validated_data.get("team") is not None
        if not assigning_free:  # asignarlo lo valida _check_team_change (solo a un equipo propio)
            self.assert_can_write(coach)
        assert_no_foreign_account(user, serializer)
        self._check_team_change(serializer)
        serializer.save()


class GuardianViewSet(NoDeleteModelViewSet):
    queryset = Guardian.objects.all()
    serializer_class = s.GuardianSerializer
    filterset_fields = ["is_active"]
    search_fields = ["first_name", "last_name"]

    def assert_can_write(self, instance):
        """Un representante lo modifica el equipo actual de alguno de sus representados (o quien lo creó)."""
        user = self.request.user
        if is_registry_admin(user) or instance.created_by_id == user.pk:
            return
        if not any(p.current_team and p.current_team.is_staff_user(user)
                   for p in instance.players.select_related("current_team")):
            raise PermissionDenied("Solo puede modificar representantes de jugadores de su equipo.")

    def perform_update(self, serializer):
        self.assert_can_write(serializer.instance)
        serializer.save()


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
            Player.objects.select_related("guardian", "current_team", "released_from")
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

    def assert_can_write(self, instance):
        """La ficha la actualiza el equipo actual del jugador (o un administrador)."""
        assert_team_owned(self.request.user, instance.current_team, instance, "la ficha de este jugador")

    def perform_update(self, serializer):
        self.assert_can_write(serializer.instance)
        self._check_current_team(serializer)
        serializer.save()

    # Sin decorador: ModelActionPermission exige registry.change_player.
    @action(detail=True, methods=["post"])
    def release(self, request, pk=None):
        """
        Desvincula al jugador de su equipo actual (salió de la escuela): queda libre. Sus nóminas no cambian;
        el equipo lo sigue viendo entre sus jugadores para readmitirlo si vuelve.
        """
        player = self.get_object()
        team = player.current_team
        if team is None:
            raise ValidationError("El jugador ya está libre (sin equipo actual).")
        self.assert_can_write(player)
        player.released_from, player.current_team = team, None
        player.save(update_fields=["current_team", "released_from", "updated_at"])
        record("release_player", player, user=request.user, changes={"equipo": team.name})
        return Response(self.get_serializer(self.get_queryset().get(pk=player.pk)).data)

    @action(detail=True, methods=["post"])
    def readmit(self, request, pk=None):
        """Incorpora a un jugador libre al equipo indicado (que debe ser propio, salvo para administradores)."""
        player = self.get_object()
        team = get_object_or_404(Team, pk=request.data.get("team"), is_active=True)
        if not player.is_active:
            raise ValidationError("El jugador está inactivo.")
        if player.current_team_id is not None:
            raise ValidationError(f"El jugador pertenece a «{player.current_team.name}»: ese equipo debe desvincularlo primero.")
        if not (is_registry_admin(request.user) or team.is_staff_user(request.user)):
            raise PermissionDenied("Solo puede incorporar jugadores a sus equipos.")
        player.current_team = team
        player.save(update_fields=["current_team", "updated_at"])
        record("readmit_player", player, user=request.user, changes={"equipo": team.name})
        return Response(self.get_serializer(self.get_queryset().get(pk=player.pk)).data)


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
        user = self.request.user
        if self.request.query_params.get("mine") == "1":
            qs = qs.filter(Q(managers=user) | Q(coaches__user=user)).distinct()
        # Los equipos propios (como gestor o entrenador) encabezan el listado, salvo que se pida otro orden.
        own = own_team_ids(user)
        if own and not self.request.query_params.get("ordering"):
            qs = qs.annotate(is_own_team=Case(When(pk__in=own, then=1), default=0, output_field=IntegerField()))
            qs = qs.order_by("-is_own_team", *Team._meta.ordering)
        return qs
