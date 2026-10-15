"""Gestión del fixture: reemplazarlo, borrar varios borradores y proteger los partidos de la llave."""
from django.core.management import call_command
from django.test import TestCase
from rest_framework.test import APIClient

from apps.accounts import roles
from apps.competition.models import Match, Stage
from apps.competition.services import bracket
from apps.core import factories as f
from apps.tournaments.models import Tournament


class FixtureManagementTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        call_command("seed_roles", verbosity=0)
        cls.authority = f.user("autoridad", role=roles.AUTHORITY)
        cls.cat = f.category()
        cls.tournament = f.tournament(categories=[cls.cat])
        for i in range(4):
            f.register(cls.tournament, f.team(f"Equipo{i}", cls.cat, players=0), cls.cat, with_roster=False)

    def setUp(self):
        self.api = APIClient()
        self.api.force_authenticate(self.authority)

    def generate(self, **extra):
        return self.api.post("/api/matches/generate-fixture/", {"tournament": self.tournament.id, "category": self.cat.id, **extra},
                             format="json")

    def matches(self):
        return Match.objects.filter(tournament=self.tournament, stage=Stage.REGULAR)

    def test_replace_regenerates_draft_fixture(self):
        self.assertEqual(self.generate().status_code, 201)
        self.assertEqual(self.matches().count(), 6)
        self.assertEqual(self.generate().status_code, 400)  # ya existe
        res = self.generate(replace=True, double=True)
        self.assertEqual(res.status_code, 201, res.data)
        self.assertEqual(self.matches().count(), 12)

    def test_replace_refuses_when_a_match_was_submitted(self):
        self.generate()
        self.matches().filter(pk=self.matches().first().pk).update(status=Match.Status.PENDING)
        self.assertEqual(self.generate(replace=True).status_code, 400)
        self.assertEqual(self.matches().count(), 6)

    def test_bulk_delete_only_removes_regular_drafts(self):
        self.generate()
        ids = list(self.matches().values_list("id", flat=True))
        self.matches().filter(pk=ids[0]).update(status=Match.Status.PENDING)
        res = self.api.post("/api/matches/bulk-delete/", {"tournament": self.tournament.id, "ids": ids[:3]}, format="json")
        self.assertEqual(res.status_code, 200, res.data)
        self.assertEqual(res.data, {"deleted": 2, "skipped": 1})
        self.assertEqual(self.matches().count(), 4)

    def test_knockout_match_cannot_be_deleted_individually(self):
        knockout = f.tournament("Copa KO", categories=[self.cat], modality=Tournament.Modality.KNOCKOUT)
        for i in range(4):
            f.register(knockout, f.team(f"KO{i}", self.cat, players=0), self.cat, with_roster=False)
        bracket.create_bracket(knockout, self.cat.id, Stage.SF, self.authority)
        final = Match.objects.get(tournament=knockout, stage=Stage.FINAL)
        self.assertEqual(self.api.delete(f"/api/matches/{final.id}/").status_code, 400)
        self.assertTrue(Match.objects.filter(pk=final.pk).exists())
