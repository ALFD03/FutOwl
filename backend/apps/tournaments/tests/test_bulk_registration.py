"""Inscripción de varios equipos a la vez, cada uno en varias categorías."""
from django.core.management import call_command
from django.test import TestCase
from rest_framework.test import APIClient

from apps.accounts import roles
from apps.core import factories as f
from apps.tournaments.models import TournamentTeam


class BulkRegistrationTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        call_command("seed_roles", verbosity=0)
        cls.authority = f.user("autoridad", role=roles.AUTHORITY)
        cls.sub15 = f.category("Sub-15")
        cls.sub17 = f.category("Sub-17")
        cls.tournament = f.tournament("Copa", categories=[cls.sub15, cls.sub17])
        cls.halcones = f.team("Halcones", cls.sub15, players=0)
        cls.halcones.categories.add(cls.sub17)
        cls.lobos = f.team("Lobos", cls.sub15, players=0)

    def setUp(self):
        self.api = APIClient()
        self.api.force_authenticate(self.authority)

    def post(self, teams):
        return self.api.post("/api/registrations/bulk/", {"tournament": self.tournament.id, "teams": teams},
                             format="json")

    def test_registers_several_teams_and_categories(self):
        res = self.post([{"team": self.halcones.id, "categories": [self.sub15.id, self.sub17.id]},
                         {"team": self.lobos.id, "categories": [self.sub15.id]}])
        self.assertEqual(res.status_code, 201, res.data)
        self.assertEqual(res.data, {"created": 3, "errors": []})
        self.assertEqual(TournamentTeam.objects.filter(tournament=self.tournament).count(), 3)

    def test_invalid_entries_do_not_block_the_rest(self):
        f.register(self.tournament, self.lobos, self.sub15, with_roster=False)
        res = self.post([{"team": self.lobos.id, "categories": [self.sub15.id, self.sub17.id]},
                         {"team": self.halcones.id, "categories": [self.sub17.id]}])
        self.assertEqual(res.data["created"], 1)
        self.assertEqual({e["category"] for e in res.data["errors"]}, {self.sub15.id, self.sub17.id})
        self.assertTrue(TournamentTeam.objects.filter(team=self.halcones, category=self.sub17).exists())

    def test_inactive_registration_is_reactivated(self):
        registration = f.register(self.tournament, self.lobos, self.sub15, with_roster=False)
        TournamentTeam.objects.filter(pk=registration.pk).update(is_active=False)
        res = self.post([{"team": self.lobos.id, "categories": [self.sub15.id]}])
        self.assertEqual(res.data, {"created": 1, "errors": []})
        registration.refresh_from_db()
        self.assertTrue(registration.is_active)

    def test_requires_permission(self):
        self.api.force_authenticate(f.user("sin-rol"))
        self.assertEqual(self.post([{"team": self.lobos.id, "categories": [self.sub15.id]}]).status_code, 403)
