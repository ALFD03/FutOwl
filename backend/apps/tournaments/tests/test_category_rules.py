"""Reglas de juego: las de la categoría son la base; un torneo puede ajustarlas y volver a ellas al desactivar."""
from datetime import datetime, time, timedelta

from django.core.management import call_command
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from apps.accounts import roles
from apps.competition.models import Match
from apps.competition.services.parties import required_official_parties
from apps.core import factories as f


class CategoryRulesTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        call_command("seed_roles", verbosity=0)
        cls.authority = f.user("autoridad", role=roles.AUTHORITY)
        cls.sub12 = f.category("Sub 12", 11)
        cls.sub8 = f.category("Sub 8", 7)
        cls.other = f.category("Sub 16", 15)
        cls.tournament = f.tournament(categories=[cls.sub12, cls.sub8])
        home = f.register(cls.tournament, f.team("Halcones FC", cls.sub8, players=0), cls.sub8, with_roster=False)
        away = f.register(cls.tournament, f.team("Lobos FC", cls.sub8, players=0), cls.sub8, with_roster=False)
        cls.match = Match.objects.create(tournament=cls.tournament, category=cls.sub8, home=home, away=away)

    def setUp(self):
        self.api = APIClient()
        self.api.force_authenticate(self.authority)

    def create_rules(self, category, **values):
        payload = {"tournament": self.tournament.id, "category": category.id, "match_duration_minutes": 40,
                   "periods": 2, "break_minutes": 5, "max_lineup_players": 12, "starters_count": 7,
                   "referees_required": 1, **values}
        return self.api.post("/api/category-rules/", payload, format="json")

    def test_category_without_adjustment_uses_category_rules(self):
        res = self.api.get(f"/api/matches/{self.match.id}/")
        self.assertEqual(res.data["rules"]["match_duration_minutes"], 60)
        self.assertEqual(res.data["rules"]["referees_required"], 3)

    def test_category_rules_apply_to_its_matches(self):
        res = self.create_rules(self.sub8)
        self.assertEqual(res.status_code, 201, res.data)
        res = self.api.get(f"/api/matches/{self.match.id}/")
        self.assertEqual(res.data["rules"]["match_duration_minutes"], 40)
        self.assertEqual(res.data["rules"]["starters_count"], 7)
        match = Match.objects.get(pk=self.match.pk)
        self.assertEqual(required_official_parties(match), ["delegate", "referee"])

        start = timezone.make_aware(datetime.combine(timezone.localdate() + timedelta(days=2), time(9, 0)))
        res = self.api.patch(f"/api/matches/{self.match.id}/", {"scheduled_start": start.isoformat()}, format="json")
        self.assertEqual(res.status_code, 200, res.data)
        match.refresh_from_db()
        self.assertEqual(match.scheduled_end - match.scheduled_start, timedelta(minutes=45))

    def test_deactivated_rules_fall_back_to_category(self):
        rules_id = self.create_rules(self.sub8).data["id"]
        self.api.post(f"/api/category-rules/{rules_id}/deactivate/")
        res = self.api.get(f"/api/matches/{self.match.id}/")
        self.assertEqual(res.data["rules"]["match_duration_minutes"], 60)

    def test_rejects_category_outside_tournament_and_invalid_lineup(self):
        res = self.create_rules(self.other)
        self.assertEqual(res.status_code, 400)
        self.assertIn("category", res.data)
        res = self.create_rules(self.sub12, starters_count=15, max_lineup_players=12)
        self.assertEqual(res.status_code, 400)
        self.assertIn("starters_count", res.data)
