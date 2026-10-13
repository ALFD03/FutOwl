"""Flujo de jornada: la autoridad envía cancha y horario; los jefes asignan oficiales; al confirmar estos, se avisa a los equipos."""
from datetime import datetime, time, timedelta

from django.core.management import call_command
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from apps.accounts import roles
from apps.competition.models import Match, Matchday
from apps.core import factories as f
from apps.notifications.models import Notification


class AssignmentFlowTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        call_command("seed_roles", verbosity=0)
        cls.authority = f.user("autoridad", role=roles.AUTHORITY)
        cls.head_delegate = f.user("jefe_delegados", role=roles.HEAD_DELEGATE)
        cls.head_referee = f.user("jefe_arbitros", role=roles.HEAD_REFEREE)
        cls.delegate_user = f.user("delegado", role=roles.DELEGATE)
        cls.referee_user = f.user("arbitro", role=roles.REFEREE)
        cls.manager = f.user("gestor", role=roles.TEAM_MANAGER)
        cls.cat = f.category(referees_required=1)
        cls.field = f.field()
        cls.delegate = f.official("Delegate", "Ana", "Delegada", cls.delegate_user)
        cls.referee = f.official("Referee", "Luis", "Árbitro", cls.referee_user)
        tournament = f.tournament(categories=[cls.cat], fields=[cls.field])
        home = f.register(tournament, f.team("Halcones FC", cls.cat, manager=cls.manager, players=0), cls.cat, with_roster=False)
        away = f.register(tournament, f.team("Lobos FC", cls.cat, players=0), cls.cat, with_roster=False)
        start = timezone.make_aware(datetime.combine(timezone.localdate() + timedelta(days=3), time(9, 0)))
        cls.matchday = Matchday.objects.create(tournament=tournament, number=1, date=timezone.localtime(start).date())
        cls.match = Match.objects.create(tournament=tournament, category=cls.cat, home=home, away=away,
                                         matchday=cls.matchday, field=cls.field, scheduled_start=start,
                                         scheduled_end=start + timedelta(minutes=70))

    def api(self, user):
        client = APIClient()
        client.force_authenticate(user)
        return client

    def titles(self, user):
        return list(Notification.objects.filter(recipient=user).values_list("title", flat=True))

    def test_full_flow(self):
        # 1. La autoridad envía solo con cancha y horario
        res = self.api(self.authority).post(f"/api/matchdays/{self.matchday.id}/submit/")
        self.assertEqual(res.status_code, 200, res.data)
        self.assertIn("Jornada lista para asignar delegados", self.titles(self.head_delegate))
        self.assertIn("Jornada lista para asignar árbitros", self.titles(self.head_referee))
        self.assertEqual(self.titles(self.manager), [])  # los equipos aún no se enteran

        # 2. Cada jefe asigna lo suyo (no lo del otro)
        url = f"/api/matches/{self.match.id}/assign-officials/"
        self.assertEqual(self.api(self.head_referee).post(url, {"delegate": self.delegate.id}, format="json").status_code, 403)
        self.assertEqual(self.api(self.head_delegate).post(url, {"delegate": self.delegate.id}, format="json").status_code, 200)
        self.assertEqual(self.api(self.head_referee).post(url, {"referee": self.referee.id}, format="json").status_code, 200)
        self.assertIn("Nueva asignación pendiente de confirmación", self.titles(self.delegate_user))

        # 3. Confirman los oficiales → partido confirmado y aviso a los equipos
        for user, party in ((self.delegate_user, "delegate"), (self.referee_user, "referee")):
            res = self.api(user).post(f"/api/matches/{self.match.id}/respond/", {"party": party, "response": "accepted"},
                                      format="json")
            self.assertEqual(res.status_code, 201, res.data)
        self.match.refresh_from_db()
        self.assertEqual(self.match.status, Match.Status.CONFIRMED)
        self.assertIn("Partido programado", self.titles(self.manager))

        # 4. Un oficial confirmado ya no se cambia por asignación directa
        self.match.status = Match.Status.PENDING
        self.match.save(update_fields=["status"])
        other = f.official("Delegate", "José", "Delegado")
        res = self.api(self.head_delegate).post(url, {"delegate": other.id}, format="json")
        self.assertEqual(res.status_code, 400)
