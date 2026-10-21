from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.utils.text import slugify
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response

from apps.audit.services import record
from apps.core.mixins import NoDeleteModelViewSet
from apps.core.permissions import require_perms
from apps.registry.models import Category, Team

from . import documents, services
from .models import CategoryRules, Group, TeamPlayer, Tournament, TournamentTeam
from .serializers import (
    BulkRegistrationSerializer, BulkRosterSerializer, CategoryRulesSerializer, GroupSerializer, RosterCandidateSerializer,
    TeamPlayerSerializer, TournamentSerializer, TournamentTeamSerializer,
)


def _file_response(content: bytes, fmt: str, name: str) -> HttpResponse:
    response = HttpResponse(content, content_type=documents.CONTENT_TYPES[fmt])
    response["Content-Disposition"] = f'attachment; filename="{slugify(name)}.{fmt}"'
    response["Cache-Control"] = "no-store"
    return response


class TournamentViewSet(NoDeleteModelViewSet):
    queryset = Tournament.objects.prefetch_related("categories", "fields", "registrations", "category_rules__category")
    serializer_class = TournamentSerializer
    filterset_fields = ["is_active", "status", "modality", "categories"]
    search_fields = ["name"]

    def destroy(self, request, pk=None):
        """Solo torneos en borrador: se borran definitivamente (ver services.delete_draft_tournament)."""
        try:
            services.delete_draft_tournament(self.get_object(), request.user)
        except DjangoValidationError as exc:
            raise ValidationError({"detail": exc.messages})
        return Response(status=status.HTTP_204_NO_CONTENT)

    def _format(self, request) -> str:
        fmt = request.query_params.get("format_type", "pdf")
        if fmt not in documents.CONTENT_TYPES:
            raise ValidationError({"format_type": "Use pdf o docx."})
        return fmt

    def _team_category(self, request):
        team = get_object_or_404(Team, pk=request.query_params.get("team"))
        category = get_object_or_404(Category, pk=request.query_params.get("category"))
        return team, category

    @action(detail=True, methods=["get"], url_path="documents/lineup-sheet")
    def lineup_sheet(self, request, pk=None):
        """Exporta la planilla de alineación (generada automáticamente con la nómina)."""
        from apps.competition.models import Lineup, Match

        tournament = self.get_object()
        fmt = self._format(request)
        team, category = self._team_category(request)
        match = lineup = None
        if request.query_params.get("match"):
            match = get_object_or_404(Match, pk=request.query_params["match"], tournament=tournament)
            lineup = Lineup.objects.filter(match=match, team__team=team).prefetch_related("players").first()
        roster = (TeamPlayer.objects.filter(registration__tournament=tournament, registration__team=team,
                                            registration__category=category, is_active=True)
                  .select_related("player").order_by("shirt_number", "player__last_name"))
        blocks = documents.lineup_sheet(tournament, team, category, roster, match=match, lineup=lineup,
                                        coaches=team.coaches.filter(is_active=True))
        record("export_document", tournament, user=request.user, changes={"documento": "planilla", "equipo": team.id})
        return _file_response(documents.render(blocks, fmt, "Planilla de alineación"), fmt,
                              f"planilla-{team.name}-{category.name}")

    @action(detail=True, methods=["get"], url_path="documents/substitution-cards")
    def substitution_cards(self, request, pk=None):
        tournament = self.get_object()
        fmt = self._format(request)
        team, category = self._team_category(request)
        count = min(max(int(request.query_params.get("count", 6)), 1), 30)
        blocks = documents.substitution_cards(tournament, team, category, count=count)
        return _file_response(documents.render(blocks, fmt, "Tarjetas de cambio"), fmt,
                              f"tarjetas-cambio-{team.name}")

    @action(detail=True, methods=["get"], url_path="documents/regulation")
    def regulation(self, request, pk=None):
        tournament = self.get_object()
        fmt = self._format(request)
        return _file_response(documents.render(documents.regulation(tournament), fmt, "Reglamento"), fmt,
                              f"reglamento-{tournament.name}")


class CategoryRulesViewSet(NoDeleteModelViewSet):
    """Reglas de juego por categoría. Desactivarlas devuelve la categoría a las reglas generales."""

    queryset = CategoryRules.objects.select_related("category")
    serializer_class = CategoryRulesSerializer
    filterset_fields = ["tournament", "category", "is_active"]


class GroupViewSet(NoDeleteModelViewSet):
    queryset = Group.objects.select_related("category").prefetch_related("teams")
    serializer_class = GroupSerializer
    filterset_fields = ["tournament", "category", "is_active"]


class TournamentTeamViewSet(NoDeleteModelViewSet):
    queryset = TournamentTeam.objects.select_related("tournament", "team", "category", "group").prefetch_related("roster")
    serializer_class = TournamentTeamSerializer
    filterset_fields = ["tournament", "category", "group", "team", "is_active"]
    search_fields = ["team__name"]

    def update(self, request, *args, **kwargs):
        """Al mover un equipo de grupo, el fixture de los grupos afectados se rehace solo (si sigue en borrador)."""
        previous = self.get_object().group
        response = super().update(request, *args, **kwargs)
        registration = self.get_object()
        if previous != registration.group and registration.tournament.modality == Tournament.Modality.GROUPS_KNOCKOUT:
            from apps.competition.services.bracket import sync_group_fixture

            updated, kept = 0, []
            for group in {previous, registration.group} - {None}:
                created = sync_group_fixture(group, request.user)
                if created is None:
                    kept.append(group.name)
                else:
                    updated += created
            response.data["fixture"] = {"created": updated, "kept": sorted(kept)}
        return response

    @action(detail=False, methods=["post"])
    @require_perms("tournaments.add_tournamentteam")
    def bulk(self, request):
        """Inscribe varios equipos a la vez, cada uno en las categorías indicadas."""
        serializer = BulkRegistrationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        tournament = get_object_or_404(Tournament, pk=serializer.validated_data["tournament"])
        result = services.register_teams(tournament, serializer.validated_data["teams"], request.user)
        return Response(result, status=status.HTTP_201_CREATED if result["created"] else status.HTTP_200_OK)


class RosterViewSet(NoDeleteModelViewSet):
    """
    Nómina por torneo. Los gestores y entrenadores con usuario administran la de sus equipos.
    Inscribir a un jugador lo deja con ese equipo como equipo actual.
    """

    queryset = TeamPlayer.objects.select_related(
        "tournament", "registration__team", "registration__category", "player", "player__guardian"
    )
    serializer_class = TeamPlayerSerializer
    filterset_fields = {
        "registration": ["exact"], "tournament": ["exact"], "registration__team": ["exact"],
        "registration__category": ["exact"], "player": ["exact"], "is_active": ["exact"],
    }
    search_fields = ["player__first_name", "player__last_name"]

    def _assert_can_manage(self, registration):
        user = self.request.user
        if user.is_superuser or user.has_perm("registry.change_team") or user.has_perm("tournaments.change_tournament"):
            return
        if not registration.team.is_staff_user(user):
            raise PermissionDenied("Solo puede gestionar la nómina de sus equipos.")

    def perform_create(self, serializer):
        registration = serializer.validated_data["registration"]
        self._assert_can_manage(registration)
        entry = serializer.save()
        player = entry.player
        if player.current_team_id != registration.team_id:
            player.current_team_id = registration.team_id
            player.save(update_fields=["current_team", "updated_at"])

    def _registration(self, value) -> TournamentTeam:
        if not str(value).isdigit():
            raise ValidationError({"registration": "Indique la inscripción."})
        registration = get_object_or_404(TournamentTeam.objects.select_related("tournament", "team", "category"),
                                         pk=value, is_active=True)
        self._assert_can_manage(registration)
        return registration

    @action(detail=False, methods=["get"])
    def candidates(self, request):
        """Propuesta de nómina de una inscripción (?registration=id): los jugadores del equipo de esa categoría."""
        registration = self._registration(request.query_params.get("registration"))
        return Response(RosterCandidateSerializer(services.roster_candidates(registration), many=True,
                                                  context={"request": request}).data)

    @action(detail=False, methods=["post"])
    @require_perms("tournaments.add_teamplayer")
    def bulk(self, request):
        """Inscribe en la nómina, de una vez, los jugadores revisados de la propuesta."""
        serializer = BulkRosterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        registration = self._registration(serializer.validated_data["registration"])
        result = services.enroll_players(registration, serializer.validated_data["players"], request.user)
        return Response(result, status=status.HTTP_201_CREATED if result["created"] else status.HTTP_200_OK)

    # Sin decorador: ModelActionPermission exige tournaments.change_teamplayer (igual que dar de baja de a uno).
    @action(detail=False, methods=["post"], url_path="bulk-deactivate")
    def bulk_deactivate(self, request):
        """Da de baja de la nómina a varios jugadores a la vez (los registros se conservan)."""
        ids = request.data.get("ids")
        if not isinstance(ids, list) or not ids:
            raise ValidationError({"ids": "Indique los jugadores a dar de baja."})
        try:
            ids = [int(i) for i in ids]
        except (TypeError, ValueError):
            raise ValidationError({"ids": "Identificadores inválidos."})
        entries = list(self.get_queryset().filter(pk__in=ids, is_active=True))
        for entry in entries:
            self._assert_can_manage(entry.registration)
            if entry.tournament.status == Tournament.Status.FINISHED:
                raise ValidationError("El torneo ya finalizó: su nómina no se modifica.")
        with transaction.atomic():
            for entry in entries:
                entry.is_active = False
                entry.save(update_fields=["is_active", "updated_at"])
                record("deactivate", entry, user=request.user, changes={"is_active": False})
        return Response({"deactivated": len(entries)})

    def perform_update(self, serializer):
        self._assert_can_manage(serializer.instance.registration)
        if serializer.validated_data.get("registration", serializer.instance.registration) != serializer.instance.registration:
            raise ValidationError({"registration": "Para cambiar de equipo, dé de baja e inscriba de nuevo."})
        serializer.save()

    def _set_active(self, request, value):
        entry = self.get_object()
        self._assert_can_manage(entry.registration)
        if value and not entry.is_active:
            entry.is_active = True
            try:
                entry.clean()  # ¿sigue libre en el torneo y con dorsal disponible?
            except DjangoValidationError as exc:
                raise ValidationError(exc.message_dict)
        return super()._set_active(request, value)

