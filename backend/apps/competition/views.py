import json
from datetime import date

from django.core.exceptions import ValidationError as DjangoValidationError
from django.db.models import Q
from django.shortcuts import get_object_or_404
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response

from apps.audit.services import record
from apps.core.permissions import ModelActionPermission, require_perms
from apps.notifications.services import notify_permission
from apps.registry.models import Field
from apps.tournaments.models import Tournament

from . import serializers as s
from .models import Match, Matchday, MatchNote, MatchReport, ReviewCase, Stage
from .services import auto_schedule, bracket, confirmations, fixtures, lineups, live, reports, reviews, scheduling, standings
from .services.parties import confirmation_summary, parties_for_user

PROTECTED = [ModelActionPermission]


class MatchdayViewSet(viewsets.ModelViewSet):
    queryset = Matchday.objects.select_related("tournament").prefetch_related("matches")
    serializer_class = s.MatchdaySerializer
    permission_classes = viewsets.ModelViewSet.permission_classes + PROTECTED
    filterset_fields = ["tournament", "status", "date"]
    ordering_fields = ["date", "number"]

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    def perform_destroy(self, instance):
        if instance.status != Matchday.Status.DRAFT:
            raise ValidationError("Solo se eliminan jornadas en borrador.")
        scheduling.delete_draft_matchdays(instance.tournament, [instance.pk], self.request.user)

    @action(detail=False, methods=["post"], url_path="bulk-delete")
    @require_perms("competition.delete_matchday")
    def bulk_delete(self, request):
        """Elimina varias jornadas en borrador de un torneo; sus partidos vuelven al fixture sin programar."""
        tournament = get_object_or_404(Tournament, pk=request.data.get("tournament"))
        ids = request.data.get("ids")
        if not isinstance(ids, list) or not ids:
            raise ValidationError({"ids": "Indique las jornadas a eliminar."})
        try:
            ids = [int(i) for i in ids]
        except (TypeError, ValueError):
            raise ValidationError({"ids": "Identificadores inválidos."})
        return Response(scheduling.delete_draft_matchdays(tournament, ids, request.user))

    @action(detail=True, methods=["get"])
    def completeness(self, request, pk=None):
        return Response(scheduling.matchday_completeness(self.get_object()))

    @action(detail=False, methods=["post"], url_path="auto-schedule")
    @require_perms("competition.add_matchday", "competition.change_match")
    def auto_schedule(self, request):
        """
        Genera jornadas cubriendo los partidos sin jornada: `start_date`, `days` (días de la semana, lunes = 0),
        `fields` [{id, start, end}] (horario de cada cancha; sin él, todas de 9:00 a 18:00) y opcionalmente
        `categories`. Con `commit` las crea; sin él, solo la vista previa.
        """
        data = request.data
        tournament = get_object_or_404(Tournament, pk=data.get("tournament"))
        try:
            options = {
                "start_date": date.fromisoformat(str(data.get("start_date"))),
                "days": data.get("days"),
                "fields": data.get("fields") or None,
                "category_ids": [int(i) for i in data.get("categories") or []],
            }
        except (TypeError, ValueError):
            raise ValidationError({"detail": "Revise la fecha de apertura."})
        try:
            if data.get("commit"):
                return Response(auto_schedule.create_matchdays(tournament, request.user, **options), status=status.HTTP_201_CREATED)
            return Response(auto_schedule.serialize_plan(auto_schedule.plan_matchdays(tournament, **options)))
        except DjangoValidationError as exc:
            raise ValidationError(exc.message_dict if hasattr(exc, "error_dict") else {"detail": exc.messages})

    @action(detail=True, methods=["post"], url_path="add-matches")
    @require_perms("competition.change_match")
    def add_matches(self, request, pk=None):
        """Agrega varios partidos del fixture a la jornada; `field` opcional los deja en esa cancha."""
        ids = request.data.get("ids")
        if not isinstance(ids, list) or not ids:
            raise ValidationError({"ids": "Indique los partidos a agregar."})
        field = get_object_or_404(Field, pk=request.data["field"]) if request.data.get("field") else None
        try:
            result = scheduling.add_matches(self.get_object(), [int(i) for i in ids], request.user, field)
        except (TypeError, ValueError):
            raise ValidationError({"ids": "Identificadores inválidos."})
        except DjangoValidationError as exc:
            raise ValidationError(exc.message_dict if hasattr(exc, "error_dict") else {"detail": exc.messages})
        return Response(result)

    @action(detail=True, methods=["post"])
    @require_perms("competition.submit_matchday")
    def submit(self, request, pk=None):
        matchday = scheduling.submit_matchday(self.get_object(), request.user)
        return Response(self.get_serializer(matchday).data)

    @action(detail=True, methods=["post"])
    @require_perms("competition.close_matchday")
    def close(self, request, pk=None):
        matchday = reports.close_matchday(self.get_object(), request.user)
        return Response(self.get_serializer(matchday).data)


OFFICIAL_FIELDS = {
    "competition.assign_delegate": {"delegate"},
    "competition.assign_referees": {"referee", "assistant_referee_1", "assistant_referee_2"},
}


def assert_official_scope(user, full_perm: str, changed: set[str]):
    """
    Con `full_perm` (programar / ajustar) se cambia todo. Los jefes de delegados o de árbitros solo
    asignan a los oficiales de su tipo: cualquier otro campo modificado se rechaza.
    """
    if user.has_perm(full_perm):
        return
    allowed = set().union(*(fields for perm, fields in OFFICIAL_FIELDS.items() if user.has_perm(perm)))
    if changed - allowed:
        names = {"delegate": "el delegado", "referee": "la terna arbitral"}
        what = " y ".join(names[f] for f in ("delegate", "referee") if f in allowed) or "nada"
        raise PermissionDenied(f"Solo puede asignar {what}; cancha, horario y jornada los programa la autoridad.")


class MatchViewSet(viewsets.ModelViewSet):
    queryset = Match.objects.select_related(
        "tournament", "category", "group", "home__team", "away__team", "matchday", "field", "delegate", "referee",
        "assistant_referee_1", "assistant_referee_2",
    ).prefetch_related("tournament__category_rules")
    permission_classes = viewsets.ModelViewSet.permission_classes + PROTECTED
    parser_classes = [JSONParser, MultiPartParser, FormParser]
    filterset_fields = ["tournament", "category", "group", "matchday", "status", "field", "round_number"]
    search_fields = ["home__team__name", "away__team__name"]
    ordering_fields = ["scheduled_start", "round_number", "id"]
    # Los asignadores de oficiales también editan el partido, pero solo sus campos (ver perform_update).
    alternative_perms = {action: list(OFFICIAL_FIELDS) for action in ("update", "partial_update")}

    def get_serializer_class(self):
        if self.action in ("create", "update", "partial_update"):
            return s.MatchWriteSerializer
        return s.MatchSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        params = self.request.query_params
        if params.get("mine") == "1":
            user = self.request.user
            qs = qs.filter(
                Q(delegate__user=user) | Q(referee__user=user) | Q(assistant_referee_1__user=user)
                | Q(assistant_referee_2__user=user) | Q(home__team__managers=user) | Q(away__team__managers=user)
                | Q(home__team__coaches__user=user) | Q(away__team__coaches__user=user)
            ).distinct()
        if params.get("unscheduled") == "1":
            qs = qs.filter(matchday__isnull=True)
        if params.get("date"):
            qs = qs.filter(scheduled_start__date=params["date"])
        return qs

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    def perform_update(self, serializer):
        match = serializer.instance
        changed = {key for key, value in serializer.validated_data.items()
                   if key in self.request.data and value != getattr(match, key)}
        assert_official_scope(self.request.user, "competition.change_match", changed)
        serializer.save()

    def perform_destroy(self, instance):
        if instance.is_locked:
            raise ValidationError("Solo se eliminan partidos en borrador.")
        if instance.stage != Stage.REGULAR:
            raise ValidationError("Los partidos de la eliminación directa se gestionan desde su llave (Rehacer llave).")
        record("delete", instance, changes={"partido": str(instance)})
        instance.delete()

    # ------------------------------------------------------------------ fixture
    @action(detail=False, methods=["post"], url_path="generate-fixture")
    @require_perms("competition.generate_fixture")
    def generate_fixture(self, request):
        tournament = get_object_or_404(Tournament, pk=request.data.get("tournament"))
        created = fixtures.generate_fixture(
            tournament, int(request.data.get("category")), request.user,
            group_id=request.data.get("group") or None, double=request.data.get("double"),
            replace=bool(request.data.get("replace")),
        )
        return Response({"created": len(created)}, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=["post"], url_path="bulk-delete")
    @require_perms("competition.delete_match")
    def bulk_delete(self, request):
        """Elimina varios partidos en borrador de la fase regular de un torneo."""
        tournament = get_object_or_404(Tournament, pk=request.data.get("tournament"))
        ids = request.data.get("ids")
        if not isinstance(ids, list) or not ids:
            raise ValidationError({"ids": "Indique los partidos a eliminar."})
        try:
            ids = [int(i) for i in ids]
        except (TypeError, ValueError):
            raise ValidationError({"ids": "Identificadores inválidos."})
        return Response(fixtures.delete_draft_matches(tournament, ids, request.user))

    # ------------------------------------------------------------ confirmations
    @action(detail=True, methods=["get"])
    def confirmations(self, request, pk=None):
        match = self.get_object()
        history = s.MatchConfirmationSerializer(match.confirmations.select_related("user"), many=True).data
        return Response({
            "summary": confirmation_summary(match),
            "my_parties": parties_for_user(match, request.user),
            "history": history,
        })

    @action(detail=True, methods=["post"])
    @require_perms("competition.confirm_assignment")
    def respond(self, request, pk=None):
        serializer = s.RespondSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        confirmation = confirmations.respond(self.get_object(), request.user, **serializer.validated_data)
        return Response(s.MatchConfirmationSerializer(confirmation).data, status=status.HTTP_201_CREATED)

    # --------------------------------------------------------------- ajustes
    @action(detail=True, methods=["post"])
    @require_perms("competition.adjust_match", *OFFICIAL_FIELDS, any_of=True)
    def adjust(self, request, pk=None):
        serializer = s.MatchAdjustSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = dict(serializer.validated_data)
        reason = data.pop("reason")
        assert_official_scope(request.user, "competition.adjust_match", set(data))
        adjustment = scheduling.adjust_match(self.get_object(), data, reason, request.user)
        return Response(s.MatchAdjustmentSerializer(adjustment).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], url_path="assign-officials")
    @require_perms("competition.change_match", *OFFICIAL_FIELDS, any_of=True)
    def assign_officials(self, request, pk=None):
        """Asignación de oficiales en partidos enviados (la hacen los jefes de delegados y de árbitros)."""
        serializer = s.AssignOfficialsSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = dict(serializer.validated_data)
        assert_official_scope(request.user, "competition.change_match", set(data))
        match = scheduling.assign_officials(self.get_object(), data, request.user)
        return Response(s.MatchSerializer(match, context={"request": request}).data)

    @action(detail=True, methods=["get"])
    def adjustments(self, request, pk=None):
        match = self.get_object()
        return Response(s.MatchAdjustmentSerializer(match.adjustments.select_related("user"), many=True).data)

    @action(detail=True, methods=["post"])
    @require_perms("competition.suspend_match")
    def suspend(self, request, pk=None):
        match = reports.suspend_match(self.get_object(), request.user, request.data.get("reason", ""))
        return Response(s.MatchSerializer(match, context={"request": request}).data)

    # ------------------------------------------------------------ alineaciones
    @action(detail=True, methods=["get"])
    def lineups(self, request, pk=None):
        match = self.get_object()
        qs = match.lineups.select_related("team__team", "coach").prefetch_related("players__team_player__player")
        return Response(s.LineupSerializer(qs, many=True, context={"request": request}).data)

    @action(detail=True, methods=["post"], url_path="submit-lineup")
    @require_perms("competition.submit_lineup")
    def submit_lineup(self, request, pk=None):
        data = request.data.copy() if hasattr(request.data, "copy") else dict(request.data)
        if isinstance(data.get("players"), str):
            data = {**{k: data.get(k) for k in data}, "players": json.loads(data["players"])}
        serializer = s.SubmitLineupSerializer(data=data)
        serializer.is_valid(raise_exception=True)
        v = serializer.validated_data
        lineup = lineups.submit_lineup(self.get_object(), v["team"], request.user, v["players"],
                                       coach=v.get("coach"), sheet_file=v.get("sheet_file"))
        return Response(s.LineupSerializer(lineup, context={"request": request}).data,
                        status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], url_path="import-lineup")
    @require_perms("competition.submit_lineup")
    def import_lineup(self, request, pk=None):
        """Lee la planilla (.docx/.csv) y devuelve los jugadores para revisar antes de enviar."""
        file = request.FILES.get("file")
        if not file:
            raise ValidationError({"file": "Adjunte la planilla."})
        return Response({"players": lineups.parse_lineup_file(file)})

    # -------------------------------------------------------------- mesa técnica
    @action(detail=True, methods=["get"])
    def events(self, request, pk=None):
        match = self.get_object()
        qs = match.events.select_related("team__team", "player__player", "player_in__player", "recorded_by",
                                         "annulled_by")
        return Response(s.MatchEventSerializer(qs, many=True).data)

    @action(detail=True, methods=["post"], url_path="record-event")
    @require_perms("competition.operate_match", "competition.operate_any_match", any_of=True)
    def record_event(self, request, pk=None):
        serializer = s.RecordEventSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        created = live.record_event(self.get_object(), request.user, serializer.to_service())
        return Response(s.MatchEventSerializer(created, many=True).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["get"])
    def state(self, request, pk=None):
        match = self.get_object()
        return Response({**live.public_state(match), "can_operate": live.can_operate(match, request.user),
                         "status": match.status})

    # ----------------------------------------------------------------- informes
    @action(detail=True, methods=["get"])
    def reports(self, request, pk=None):
        match = self.get_object()
        qs = match.reports.select_related("submitted_by", "returned__returned_by")
        return Response({
            "reports": s.MatchReportSerializer(qs, many=True, context={"request": request}).data,
            "comparison": reports.compare(match),
        })

    @action(detail=True, methods=["post"], url_path="submit-report")
    @require_perms("competition.submit_delegate_report", "competition.submit_referee_report", any_of=True)
    def submit_report(self, request, pk=None):
        serializer = s.SubmitReportSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = dict(serializer.validated_data)
        role = data.pop("role")
        report = reports.submit_report(self.get_object(), role, request.user, data)
        return Response(s.MatchReportSerializer(report, context={"request": request}).data,
                        status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], url_path="return-report")
    @require_perms("competition.return_report")
    def return_report(self, request, pk=None):
        report = get_object_or_404(MatchReport, pk=request.data.get("report"), match=self.get_object())
        reports.return_report(report, request.user, request.data.get("reason", ""))
        return Response({"detail": "Informe devuelto."})

    @action(detail=True, methods=["post"])
    @require_perms("competition.close_match")
    def close(self, request, pk=None):
        reports.close_match(self.get_object(), request.user, request.data.get("notes", ""),
                            winner_side=request.data.get("winner"))
        return Response(s.MatchSerializer(self.get_object(), context={"request": request}).data)

    # ------------------------------------------------------ notas y apelaciones
    @action(detail=True, methods=["get"])
    def notes(self, request, pk=None):
        match = self.get_object()
        return Response(s.MatchNoteSerializer(match.notes.select_related("author"), many=True,
                                              context={"request": request}).data)

    @action(detail=True, methods=["post"], url_path="add-note")
    @require_perms("competition.add_matchnote")
    def add_note(self, request, pk=None):
        match = self.get_object()
        user = request.user
        # Notas y apelaciones: oficiales del partido, el cuerpo de los dos equipos, autoridades y jefes de oficiales.
        if not (user.is_superuser or any(user.has_perm(p) for p in ("competition.change_match", *OFFICIAL_FIELDS))
                or parties_for_user(match, user)
                or any(side and side.team.is_staff_user(user) for side in (match.home, match.away))):
            raise PermissionDenied("Solo las partes del partido pueden agregar notas o apelaciones.")
        serializer = s.MatchNoteSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        note = serializer.save(match=match, author=request.user)
        if note.kind == MatchNote.Kind.APPEAL:
            ReviewCase.objects.create(kind=ReviewCase.Kind.APPEAL, match=match, note=note, reason=note.body,
                                      raised_by=request.user)
            notify_permission("competition.resolve_reviewcase", "Nueva apelación",
                              f"{match}: {note.body[:140]}", level="danger", link="/app/revisiones")
        return Response(s.MatchNoteSerializer(note, context={"request": request}).data,
                        status=status.HTTP_201_CREATED)


class ReviewCaseViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    queryset = ReviewCase.objects.select_related("match__home__team", "match__away__team", "raised_by",
                                                 "resolved_by", "confirmation")
    serializer_class = s.ReviewCaseSerializer
    permission_classes = viewsets.GenericViewSet.permission_classes + PROTECTED
    filterset_fields = ["status", "kind", "match"]

    @action(detail=True, methods=["post"])
    @require_perms("competition.resolve_reviewcase")
    def resolve(self, request, pk=None):
        serializer = s.ResolveCaseSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        case = reviews.resolve_case(self.get_object(), request.user, **serializer.validated_data)
        return Response(self.get_serializer(case).data)


class StandingsViewSet(viewsets.ViewSet):
    """Posiciones y estadísticas (también disponibles en la API pública)."""

    def list(self, request):
        tournament = get_object_or_404(Tournament, pk=request.query_params.get("tournament"))
        category = request.query_params.get("category")
        if not category:
            raise ValidationError({"category": "Requerido."})
        return Response(standings.standings(
            tournament, int(category), request.query_params.get("group") or None,
            include_live=request.query_params.get("live") == "1",
        ))


class KnockoutViewSet(viewsets.ViewSet):
    """
    Fase de grupos y eliminación directa de una categoría (`tournament`, `category` en la consulta o el cuerpo):
    sorteo de grupos, fixture de todos los grupos, configuración de la llave, proyección y llenado.
    """

    permission_classes = viewsets.ViewSet.permission_classes + PROTECTED

    def _target(self, data):
        tournament = get_object_or_404(Tournament, pk=data.get("tournament"))
        try:
            category = int(data.get("category"))
        except (TypeError, ValueError):
            raise ValidationError({"category": "Indique la categoría."})
        if not tournament.categories.filter(pk=category).exists():
            raise ValidationError({"category": "La categoría no está en el torneo."})
        return tournament, category

    def _run(self, func, *args):
        try:
            return func(*args)
        except DjangoValidationError as exc:
            raise ValidationError(exc.message_dict if hasattr(exc, "error_dict") else {"detail": exc.messages})

    @require_perms("competition.view_match")
    def list(self, request):
        tournament, category = self._target(request.query_params)
        return Response(bracket.bracket_view(tournament, category))

    @action(detail=False, methods=["post"], url_path="draw-groups")
    @require_perms("tournaments.add_group")
    def draw_groups(self, request):
        tournament, category = self._target(request.data)
        groups = self._run(bracket.draw_groups, tournament, category, int(request.data.get("groups") or 0), request.user)
        created = Match.objects.filter(tournament=tournament, category=category, group__in=groups).count()
        return Response({"groups": len(groups), "matches": created}, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=["post"], url_path="group-fixtures")
    @require_perms("competition.generate_fixture")
    def group_fixtures(self, request):
        tournament, category = self._target(request.data)
        created = self._run(bracket.generate_group_fixtures, tournament, category, request.user)
        return Response({"created": created}, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=["post"], url_path="create-bracket")
    @require_perms("competition.generate_fixture")
    def create_bracket(self, request):
        tournament, category = self._target(request.data)
        self._run(bracket.create_bracket, tournament, category, request.data.get("start_stage"), request.user)
        return Response(bracket.bracket_view(tournament, category), status=status.HTTP_201_CREATED)

    @action(detail=False, methods=["post"])
    @require_perms("competition.generate_fixture")
    def fill(self, request):
        tournament, category = self._target(request.data)
        self._run(bracket.fill_bracket, tournament, category, request.user)
        return Response(bracket.bracket_view(tournament, category))
