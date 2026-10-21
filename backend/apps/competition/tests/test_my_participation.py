"""Filtro «donde participo» en partidos y jornadas, y la respuesta propia en cada partido."""
from datetime import datetime, time, timedelta

from django.core.management import call_command
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from apps.accounts import roles
from apps.competition.models import Match, Matchday
from apps.core import factories as f


class MyParticipationTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        call_command("seed_roles", verbosity=0)
        cls.referee_user = f.user("arbitro", role=roles.REFEREE)
        cls.manager = f.user("gestor", role=roles.TEAM_MANAGER)
        cat = f.category(referees_required=1)
        field = f.field()
        cls.referee = f.official("Referee", "Luis", "Árbitro", cls.referee_user)
        tournament = f.tournament(categories=[cat], fields=[field])
        home = f.register(tournament, f.team("Halcones FC", cat, manager=cls.manager, players=0), cat, with_roster=False)
        away = f.register(tournament, f.team("Lobos FC", cat, players=0), cat, with_roster=False)
        other = f.register(tournament, f.team("Toros FC", cat, players=0), cat, with_roster=False)
        start = timezone.make_aware(datetime.combine(timezone.localdate() + timedelta(days=3), time(9, 0)))
        day = timezone.localtime(start).date()
        cls.matchday = Matchday.objects.create(tournament=tournament, number=1, date=day,
                                               status=Matchday.Status.SUBMITTED)
        cls.other_day = Matchday.objects.create(tournament=tournament, number=2, date=day + timedelta(days=7))
        cls.match = Match.objects.create(tournament=tournament, category=cat, home=home, away=away, matchday=cls.matchday,
                                         field=field, scheduled_start=start, scheduled_end=start + timedelta(minutes=70),
                                         referee=cls.referee, status=Match.Status.PENDING)
        Match.objects.create(tournament=tournament, category=cat, home=away, away=other, matchday=cls.other_day)

    def api(self, user):
        client = APIClient()
        client.force_authenticate(user)
        return client

    def test_matchdays_mine_only_lists_where_user_takes_part(self):
        ids = [m["id"] for m in self.api(self.referee_user).get("/api/matchdays/", {"mine": 1}).data["results"]]
        self.assertEqual(ids, [self.matchday.id])
        ids = [m["id"] for m in self.api(self.manager).get("/api/matchdays/", {"mine": 1}).data["results"]]
        self.assertEqual(ids, [self.matchday.id])

    def test_my_confirmation_shows_after_responding(self):
        client = self.api(self.referee_user)
        rows = client.get("/api/matches/", {"mine": 1}).data["results"]
        self.assertEqual([r["my_confirmation"] for r in rows], ["pending"])
        res = client.post(f"/api/matches/{self.match.id}/respond/", {"party": "referee", "response": "accepted"}, format="json")
        self.assertEqual(res.status_code, 201, res.data)
        self.assertEqual(client.get(f"/api/matches/{self.match.id}/").data["my_confirmation"], "accepted")
        # El gestor del local aún no responde (su confirmación es informativa)
        self.assertEqual(self.api(self.manager).get(f"/api/matches/{self.match.id}/").data["my_confirmation"], "pending")
