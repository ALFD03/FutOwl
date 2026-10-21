"""Desvincular jugadores que salen del equipo y readmitirlos (o incorporar jugadores libres)."""
from django.core.management import call_command
from django.test import TestCase
from rest_framework.test import APIClient

from apps.accounts import roles
from apps.core import factories as f
from apps.tournaments.models import TeamPlayer


class ReleasePlayerTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        call_command("seed_roles", verbosity=0)
        cls.manager = f.user("gestor", role=roles.TEAM_MANAGER)
        cls.rival_manager = f.user("gestor_rival", role=roles.TEAM_MANAGER)
        cls.cat = f.category("Sub 12", 11)
        cls.team = f.team("Halcones FC", cls.cat, manager=cls.manager, players=2)
        cls.rival = f.team("Lobos FC", cls.cat, manager=cls.rival_manager, players=1)
        cls.cup = f.tournament("Copa A", categories=[cls.cat])
        f.register(cls.cup, cls.team, cls.cat)

    def api(self, user):
        client = APIClient()
        client.force_authenticate(user)
        return client

    def test_release_keeps_player_visible_to_team_and_roster_intact(self):
        player = self.team.current_players.first()
        self.assertEqual(self.api(self.rival_manager).post(f"/api/players/{player.id}/release/").status_code, 403)
        res = self.api(self.manager).post(f"/api/players/{player.id}/release/")
        self.assertEqual(res.status_code, 200, res.data)
        self.assertIsNone(res.data["current_team"])
        self.assertEqual(res.data["released_from_name"], "Halcones FC")
        self.assertTrue(TeamPlayer.objects.filter(player=player, is_active=True).exists())  # la nómina no cambia

        ids = [p["id"] for p in self.api(self.manager).get("/api/players/", {"team": self.team.id}).data["results"]]
        self.assertIn(player.id, ids)
        free = [p["id"] for p in self.api(self.manager).get("/api/players/", {"free": True}).data["results"]]
        self.assertIn(player.id, free)
        self.assertEqual(self.api(self.manager).post(f"/api/players/{player.id}/release/").status_code, 400)

    def test_readmit_only_free_players_into_own_team(self):
        player = self.team.current_players.first()
        url = f"/api/players/{player.id}/readmit/"
        res = self.api(self.rival_manager).post(url, {"team": self.rival.id}, format="json")
        self.assertEqual(res.status_code, 400)  # aún pertenece a Halcones
        self.api(self.manager).post(f"/api/players/{player.id}/release/")
        res = self.api(self.rival_manager).post(url, {"team": self.team.id}, format="json")
        self.assertEqual(res.status_code, 403)  # no puede meterlo en un equipo ajeno
        res = self.api(self.manager).post(url, {"team": self.team.id}, format="json")
        self.assertEqual(res.status_code, 200, res.data)
        self.assertEqual(res.data["current_team"], self.team.id)
