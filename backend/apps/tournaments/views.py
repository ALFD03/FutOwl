from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.utils.text import slugify
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError

from apps.audit.services import record
from apps.core.mixins import NoDeleteModelViewSet
from apps.registry.models import Category, Team, TeamPlayer

from . import documents
from .models import Group, Tournament, TournamentTeam
from .serializers import GroupSerializer, TournamentSerializer, TournamentTeamSerializer


def _file_response(content: bytes, fmt: str, name: str) -> HttpResponse:
    response = HttpResponse(content, content_type=documents.CONTENT_TYPES[fmt])
    response["Content-Disposition"] = f'attachment; filename="{slugify(name)}.{fmt}"'
    response["Cache-Control"] = "no-store"
    return response


class TournamentViewSet(NoDeleteModelViewSet):
    queryset = Tournament.objects.prefetch_related("categories", "fields", "registrations")
    serializer_class = TournamentSerializer
    filterset_fields = ["is_active", "status", "modality", "categories"]
    search_fields = ["name"]

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
        roster = (TeamPlayer.objects.filter(team=team, category=category, is_active=True)
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


class GroupViewSet(NoDeleteModelViewSet):
    queryset = Group.objects.select_related("category").prefetch_related("teams")
    serializer_class = GroupSerializer
    filterset_fields = ["tournament", "category", "is_active"]


class TournamentTeamViewSet(NoDeleteModelViewSet):
    queryset = TournamentTeam.objects.select_related("team", "category", "group")
    serializer_class = TournamentTeamSerializer
    filterset_fields = ["tournament", "category", "group", "team", "is_active"]
    search_fields = ["team__name"]
