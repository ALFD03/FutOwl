"""
API pública (sin autenticación) para la web: resultados, posiciones y partidos
en vivo. Solo expone información no sensible.
"""
from datetime import timedelta

from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import serializers
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from apps.core.timeutils import today
from apps.tournaments.models import Group, Tournament

from .models import Match
from .serializers import PublicMatchEventSerializer
from .services import live, standings

PUBLIC_STATUSES = [Tournament.Status.REGISTRATION, Tournament.Status.IN_PROGRESS, Tournament.Status.FINISHED]
VISIBLE_MATCH_STATUSES = [Match.Status.CONFIRMED, Match.Status.IN_PROGRESS, Match.Status.FINISHED,
                          Match.Status.CLOSED, Match.Status.SUSPENDED]


class PublicTournamentSerializer(serializers.ModelSerializer):
    modality_display = serializers.CharField(source="get_modality_display")
    status_display = serializers.CharField(source="get_status_display")
    categories = serializers.SerializerMethodField()

    class Meta:
        model = Tournament
        fields = ["id", "name", "logo", "modality", "modality_display", "status", "status_display", "start_date",
                  "end_date", "categories"]

    def get_categories(self, obj):
        return [{"id": c.id, "name": c.name} for c in obj.categories.all()]


class PublicMatchSerializer(serializers.ModelSerializer):
    tournament_name = serializers.CharField(source="tournament.name")
    category_name = serializers.CharField(source="category.name")
    group_name = serializers.CharField(source="group.name", default=None)
    home_name = serializers.CharField(source="home.team.name")
    away_name = serializers.CharField(source="away.team.name")
    home_logo = serializers.ImageField(source="home.team.logo")
    away_logo = serializers.ImageField(source="away.team.logo")
    field_name = serializers.CharField(source="field.name", default=None)
    matchday_label = serializers.SerializerMethodField()
    status_display = serializers.CharField(source="get_status_display")
    score = serializers.SerializerMethodField()

    class Meta:
        model = Match
        fields = ["id", "tournament", "tournament_name", "category", "category_name", "group_name", "round_number",
                  "home_name", "away_name", "home_logo", "away_logo", "field_name", "sub_field", "scheduled_start",
                  "matchday_label", "status", "status_display", "phase", "current_period", "score"]

    def get_matchday_label(self, obj):
        return str(obj.matchday) if obj.matchday else None

    def get_score(self, obj):
        if obj.status == Match.Status.CLOSED:
            return {"home": obj.home_score, "away": obj.away_score, "minute": None, "official": True}
        if obj.status in (Match.Status.IN_PROGRESS, Match.Status.FINISHED):
            state = live.compute_state(obj)
            return {"home": state["home_score"], "away": state["away_score"], "minute": live.current_minute(obj),
                    "official": False}
        return None


MATCH_RELATED = ["tournament", "category", "group", "home__team", "away__team", "field", "matchday"]


def _public_matches():
    return Match.objects.filter(status__in=VISIBLE_MATCH_STATUSES,
                                tournament__status__in=PUBLIC_STATUSES).select_related(*MATCH_RELATED)


@api_view(["GET"])
@permission_classes([AllowAny])
def tournaments(request):
    qs = Tournament.objects.filter(is_active=True, status__in=PUBLIC_STATUSES).prefetch_related("categories")
    return Response(PublicTournamentSerializer(qs, many=True, context={"request": request}).data)


@api_view(["GET"])
@permission_classes([AllowAny])
def tournament_detail(request, pk):
    tournament = get_object_or_404(Tournament, pk=pk, is_active=True, status__in=PUBLIC_STATUSES)
    data = PublicTournamentSerializer(tournament, context={"request": request}).data
    data["groups"] = [{"id": g.id, "name": g.name, "category": g.category_id}
                      for g in Group.objects.filter(tournament=tournament, is_active=True)]
    data["regulation_text"] = tournament.regulation_text
    return Response(data)


@api_view(["GET"])
@permission_classes([AllowAny])
def tournament_standings(request, pk):
    tournament = get_object_or_404(Tournament, pk=pk, is_active=True, status__in=PUBLIC_STATUSES)
    category = request.query_params.get("category") or tournament.categories.values_list("id", flat=True).first()
    if not category:
        return Response([])
    return Response(standings.standings(tournament, int(category), request.query_params.get("group") or None,
                                        include_live=request.query_params.get("live") == "1"))


@api_view(["GET"])
@permission_classes([AllowAny])
def tournament_stats(request, pk):
    tournament = get_object_or_404(Tournament, pk=pk, is_active=True, status__in=PUBLIC_STATUSES)
    category = request.query_params.get("category")
    return Response(standings.player_stats(tournament, int(category) if category else None))


@api_view(["GET"])
@permission_classes([AllowAny])
def tournament_matches(request, pk):
    qs = _public_matches().filter(tournament_id=pk)
    if request.query_params.get("category"):
        qs = qs.filter(category_id=request.query_params["category"])
    if request.query_params.get("matchday"):
        qs = qs.filter(matchday_id=request.query_params["matchday"])
    return Response(PublicMatchSerializer(qs.order_by("scheduled_start")[:300], many=True,
                                          context={"request": request}).data)


@api_view(["GET"])
@permission_classes([AllowAny])
def live_matches(request):
    """Partidos en juego y los programados para hoy (hora de Venezuela)."""
    now = timezone.now()
    qs = _public_matches().filter(
        status__in=[Match.Status.IN_PROGRESS, Match.Status.FINISHED, Match.Status.CONFIRMED, Match.Status.CLOSED],
        scheduled_start__date=today(),
    ) | _public_matches().filter(status=Match.Status.IN_PROGRESS)
    upcoming = _public_matches().filter(status=Match.Status.CONFIRMED, scheduled_start__gt=now,
                                        scheduled_start__lte=now + timedelta(days=7))
    return Response({
        "today": PublicMatchSerializer(qs.distinct().order_by("scheduled_start"), many=True,
                                       context={"request": request}).data,
        "upcoming": PublicMatchSerializer(upcoming.order_by("scheduled_start")[:30], many=True,
                                          context={"request": request}).data,
    })


@api_view(["GET"])
@permission_classes([AllowAny])
def match_detail(request, pk):
    match = get_object_or_404(_public_matches(), pk=pk)
    data = PublicMatchSerializer(match, context={"request": request}).data
    events = match.events.filter(is_public=True).select_related("team__team", "player__player", "player_in__player",
                                                                "annulled_by")
    data["events"] = PublicMatchEventSerializer(events, many=True).data
    state = live.compute_state(match)
    data["stats"] = {
        "home": {"yellow": state["home"].yellow, "red": state["home"].red,
                 "substitutions": state["home"].substitutions},
        "away": {"yellow": state["away"].yellow, "red": state["away"].red,
                 "substitutions": state["away"].substitutions},
    }
    return Response(data)
