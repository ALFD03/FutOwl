"""Nómina por categoría: propuesta con los jugadores del equipo de esa categoría e inscripción en bloque."""
from datetime import date

from django.core.management import call_command
from django.test import TestCase
from rest_framework.test import APIClient

from apps.accounts import roles
from apps.core import factories as f
from apps.tournaments.models import TeamPlayer


class RosterByCategoryTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        call_command("seed_roles", verbosity=0)
        cls.manager = f.user("gestor", role=roles.TEAM_MANAGER)
        cls.sub10 = f.category("Sub 10", 9)
        cls.sub12 = f.category("Sub 12", 11)
        cls.team = f.team("Halcones FC", cls.sub12, manager=cls.manager, players=0)
        cls.team.categories.add(cls.sub10)
        year = date.today().year
        cls.older = f.player("Mayor", "Uno", date(cls.sub12.birth_year_limit, 3, 3), team=cls.team)
        cls.younger = f.player("Menor", "Dos", date(cls.sub10.birth_year_limit + 1, 3, 3), team=cls.team)
        cls.too_old = f.player("Viejo", "Tres", date(year - 15, 3, 3), team=cls.team)
        cls.cup = f.tournament("Copa A", categories=[cls.sub10, cls.sub12])
        cls.reg12 = f.register(cls.cup, cls.team, cls.sub12, with_roster=False)
        cls.reg10 = f.register(cls.cup, cls.team, cls.sub10, with_roster=False)

    def api(self):
        client = APIClient()
        client.force_authenticate(self.manager)
        return client

    def test_candidates_mark_players_of_the_category(self):
        TeamPlayer.objects.create(registration=self.reg12, player=self.older, shirt_number=7)
        TeamPlayer.objects.filter(player=self.older).update(is_active=False)  # dorsal anterior con el equipo
        data = self.api().get("/api/roster/candidates/", {"registration": self.reg12.id}).data
        by_player = {c["player"]["id"]: c for c in data}
        self.assertNotIn(self.too_old.id, by_player)  # no es elegible por edad
        self.assertTrue(by_player[self.older.id]["suggested"])
        self.assertEqual(by_player[self.older.id]["shirt_number"], 7)
        self.assertFalse(by_player[self.younger.id]["suggested"])  # elegible, pero es de Sub 10
        self.assertEqual(by_player[self.younger.id]["category_name"], "Sub 10")

        # Quien ya está en otra nómina del torneo no se propone
        TeamPlayer.objects.create(registration=self.reg10, player=self.younger)
        ids = [c["player"]["id"] for c in self.api().get("/api/roster/candidates/", {"registration": self.reg12.id}).data]
        self.assertNotIn(self.younger.id, ids)

    def test_bulk_enroll_saves_each_and_reports_errors(self):
        res = self.api().post("/api/roster/bulk/", {"registration": self.reg12.id, "players": [
            {"player": self.older.id, "shirt_number": 10},
            {"player": self.too_old.id, "shirt_number": 11},
        ]}, format="json")
        self.assertEqual(res.status_code, 201, res.data)
        self.assertEqual(res.data["created"], 1)
        self.assertEqual(len(res.data["errors"]), 1)
        self.assertTrue(TeamPlayer.objects.filter(registration=self.reg12, player=self.older, shirt_number=10).exists())

    def test_other_team_cannot_load_roster(self):
        other = f.user("otro", role=roles.TEAM_MANAGER)
        client = APIClient()
        client.force_authenticate(other)
        self.assertEqual(client.get("/api/roster/candidates/", {"registration": self.reg12.id}).status_code, 403)
        res = client.post("/api/roster/bulk/", {"registration": self.reg12.id, "players": [{"player": self.older.id}]},
                          format="json")
        self.assertEqual(res.status_code, 403)
