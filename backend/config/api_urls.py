"""Rutas de la API REST de FutOwl."""
from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.accounts import views as accounts
from apps.audit.views import AuditLogViewSet
from apps.competition import public_views as public
from apps.competition import views as competition
from apps.core import views as core
from apps.docs.views import DocPageViewSet
from apps.legal import views as legal
from apps.notifications.views import NotificationViewSet
from apps.registry import views as registry
from apps.tournaments import views as tournaments

router = DefaultRouter()
# Cuentas y permisos
router.register("users", accounts.UserViewSet, basename="user")
router.register("roles", accounts.GroupViewSet, basename="role")
router.register("permissions", accounts.PermissionViewSet, basename="permission")
# Registro
router.register("categories", registry.CategoryViewSet)
router.register("fields", registry.FieldViewSet)
router.register("coaches", registry.CoachViewSet)
router.register("guardians", registry.GuardianViewSet)
router.register("players", registry.PlayerViewSet)
router.register("delegates", registry.DelegateViewSet)
router.register("referees", registry.RefereeViewSet)
router.register("teams", registry.TeamViewSet)
# Torneos
router.register("tournaments", tournaments.TournamentViewSet)
router.register("groups", tournaments.GroupViewSet)
router.register("registrations", tournaments.TournamentTeamViewSet)
router.register("roster", tournaments.RosterViewSet)
# Competición
router.register("matchdays", competition.MatchdayViewSet)
router.register("matches", competition.MatchViewSet)
router.register("review-cases", competition.ReviewCaseViewSet)
router.register("standings", competition.StandingsViewSet, basename="standings")
# Transversales
router.register("notifications", NotificationViewSet, basename="notification")
router.register("audit-logs", AuditLogViewSet)
# Documentación (manual, preguntas frecuentes y permisos)
router.register("docs", DocPageViewSet, basename="doc")

auth_urls = [
    path("login/", accounts.login_view, name="login"),
    path("refresh/", accounts.refresh_view, name="token-refresh"),
    path("logout/", accounts.logout_view, name="logout"),
    path("me/", accounts.me_view, name="me"),
    path("change-password/", accounts.change_password_view, name="change-password"),
]

legal_urls = [
    path("terms/current/", legal.current_terms_view, name="terms-current"),
    path("terms/accept/", legal.accept_terms_view, name="terms-accept"),
    path("terms/publish/", legal.publish_terms_view, name="terms-publish"),
]

public_urls = [
    path("tournaments/", public.tournaments, name="public-tournaments"),
    path("tournaments/<int:pk>/", public.tournament_detail, name="public-tournament"),
    path("tournaments/<int:pk>/standings/", public.tournament_standings, name="public-standings"),
    path("tournaments/<int:pk>/stats/", public.tournament_stats, name="public-stats"),
    path("tournaments/<int:pk>/matches/", public.tournament_matches, name="public-tournament-matches"),
    path("matches/live/", public.live_matches, name="public-live"),
    path("matches/<int:pk>/", public.match_detail, name="public-match"),
]

urlpatterns = [
    path("time/", core.server_time, name="server-time"),
    path("health/", core.health, name="health"),
    path("auth/", include(auth_urls)),
    path("legal/", include(legal_urls)),
    path("public/", include(public_urls)),
    path("", include(router.urls)),
]
