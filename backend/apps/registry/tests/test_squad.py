"""Reglas de plantilla: nómina por torneo, usuarios creados desde la ficha, entrenadores y categorías."""
from datetime import date
from unittest import mock

from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.test import TestCase
from rest_framework.test import APIClient

from apps.accounts import roles
from apps.competition.models import Match, MatchEvent
from apps.core import factories as f
from apps.registry.models import Category, Coach, Delegate, Player, Team
from apps.tournaments.models import TeamPlayer

PASSWORD = "Gestor#2026!seguro"


class SquadRulesTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        call_command("seed_roles", verbosity=0)
        cls.admin = f.user("admin", superuser=True)
        cls.manager = f.user("gestor", role=roles.TEAM_MANAGER)
        cls.cat = f.category("Sub 12", 11)
        cls.team = f.team("Halcones FC", cls.cat, manager=cls.manager, players=3)
        cls.rival = f.team("Lobos FC", cls.cat, players=3)
        cls.cup = f.tournament("Copa A", categories=[cls.cat])
        cls.league = f.tournament("Liga B", categories=[cls.cat])
        cls.reg_team_cup = f.register(cls.cup, cls.team, cls.cat)
        cls.reg_rival_cup = f.register(cls.cup, cls.rival, cls.cat, with_roster=False)
        cls.reg_rival_league = f.register(cls.league, cls.rival, cls.cat, with_roster=False)

    def api(self, user):
        client = APIClient()
        client.force_authenticate(user)
        return client

    # ------------------------------------------------------------- nómina por torneo
    def test_player_cannot_join_two_teams_in_same_tournament(self):
        player = self.team.current_players.first()
        res = self.api(self.admin).post("/api/roster/", {"registration": self.reg_rival_cup.id, "player": player.id},
                                        format="json")
        self.assertEqual(res.status_code, 400)
        self.assertIn("Halcones FC", str(res.data["player"]))

    def test_player_can_join_another_team_in_another_tournament(self):
        player = self.team.current_players.first()
        res = self.api(self.admin).post("/api/roster/", {"registration": self.reg_rival_league.id,
                                                         "player": player.id, "shirt_number": 9}, format="json")
        self.assertEqual(res.status_code, 201, res.data)
        player.refresh_from_db()
        self.assertEqual(player.current_team, self.rival)  # el equipo actual pasa a ser el último que lo inscribió

        # Historial del jugador: dos equipos, dos torneos; y ambos equipos lo ven entre sus jugadores
        data = self.api(self.admin).get(f"/api/players/{player.id}/").data
        self.assertEqual({h["team_name"] for h in data["history"]}, {"Halcones FC", "Lobos FC"})
        self.assertEqual(data["stats"]["tournaments"], 2)
        for team in (self.team, self.rival):
            ids = [p["id"] for p in self.api(self.admin).get("/api/players/", {"team": team.id}).data["results"]]
            self.assertIn(player.id, ids)

    def test_available_players_exclude_those_already_in_the_tournament(self):
        free = f.player("Libre", "Pérez", date(date.today().year - 10, 5, 5))
        ids = [p["id"] for p in self.api(self.admin).get(
            "/api/players/", {"available_for": self.reg_rival_cup.id}).data["results"]]
        self.assertIn(free.id, ids)
        self.assertFalse(set(ids) & set(self.team.current_players.values_list("id", flat=True)))

    def test_only_current_team_edits_player(self):
        player = self.rival.current_players.first()
        res = self.api(self.manager).patch(f"/api/players/{player.id}/", {"first_name": "Otro"}, format="json")
        self.assertEqual(res.status_code, 403)
        own = self.team.current_players.first()
        res = self.api(self.manager).patch(f"/api/players/{own.id}/", {"first_name": "Nuevo"}, format="json")
        self.assertEqual(res.status_code, 200, res.data)

    def test_player_stats_count_goals(self):
        entry = TeamPlayer.objects.filter(registration=self.reg_team_cup).first()
        match = Match.objects.create(tournament=self.cup, category=self.cat, home=self.reg_team_cup,
                                     away=self.reg_rival_cup, status=Match.Status.FINISHED, created_by=self.admin)
        for sequence, kind in enumerate([MatchEvent.Type.GOAL, MatchEvent.Type.GOAL, MatchEvent.Type.YELLOW_CARD], 1):
            MatchEvent.objects.create(match=match, sequence=sequence, type=kind, team=self.reg_team_cup,
                                      player=entry, recorded_by=self.admin)
        stats = self.api(self.admin).get(f"/api/players/{entry.player_id}/").data["stats"]
        self.assertEqual((stats["goals"], stats["yellow_cards"]), (2, 1))

    def test_search_player_by_document(self):
        player = self.team.current_players.first()
        res = self.api(self.admin).get("/api/players/", {"search": player.vat_number})
        self.assertEqual([p["id"] for p in res.data["results"]], [player.id])
        res = self.api(self.admin).get("/api/players/", {"search": f"V-{player.vat_number}"})
        self.assertEqual(len(res.data["results"]), 1)

    # ------------------------------------------------------------- usuarios desde la ficha
    def test_team_creation_creates_access_user(self):
        payload = {"name": "Tigres FC", "vat_id": "J", "vat_number": "40123456", "state": "Carabobo",
                   "municipality": "Valencia", "address": "Calle 2"}
        res = self.api(self.admin).post("/api/teams/", payload, format="json")
        self.assertEqual(res.status_code, 400)
        self.assertIn("account_mode", res.data)

        res = self.api(self.admin).post("/api/teams/", {**payload, "account_mode": "new", "account_username": "tigres",
                                                        "account_password": PASSWORD}, format="json")
        self.assertEqual(res.status_code, 201, res.data)
        user = get_user_model().objects.get(username="tigres")
        self.assertEqual(res.data["manager_usernames"], ["tigres"])
        self.assertTrue(user.groups.filter(name=roles.TEAM_MANAGER).exists())
        self.assertTrue(user.must_change_password)
        self.assertTrue(user.check_password(PASSWORD))

    def test_delegate_with_new_user_and_weak_password(self):
        base = {"first_name": "Ana", "last_name": "Mesa", "vat_id": "V", "vat_number": "20111222",
                "license_status": "endorsed", "account_mode": "new", "account_username": "ana.mesa"}
        res = self.api(self.admin).post("/api/delegates/", {**base, "account_password": "123"}, format="json")
        self.assertEqual(res.status_code, 400)
        self.assertIn("account_password", res.data)
        res = self.api(self.admin).post("/api/delegates/", {**base, "account_password": PASSWORD}, format="json")
        self.assertEqual(res.status_code, 201, res.data)
        delegate = Delegate.objects.get(pk=res.data["id"])
        self.assertEqual(delegate.user.username, "ana.mesa")
        self.assertTrue(delegate.user.groups.filter(name=roles.DELEGATE).exists())

    def test_player_with_new_guardian_in_same_form(self):
        payload = {"first_name": "Leo", "last_name": "Niño", "birth_date": date(date.today().year - 9, 1, 1),
                   "document_kind": "birth_certificate", "guardian_mode": "new"}
        res = self.api(self.admin).post("/api/players/", payload, format="json")
        self.assertEqual(res.status_code, 400)
        self.assertIn("guardian_first_name", res.data)
        res = self.api(self.admin).post("/api/players/", {
            **payload, "guardian_first_name": "Rosa", "guardian_last_name": "Niño", "guardian_vat_number": "15555666",
            "guardian_phone": "+58 412-5551234", "guardian_relationship": "Madre",
        }, format="json")
        self.assertEqual(res.status_code, 201, res.data)
        player = Player.objects.get(pk=res.data["id"])
        self.assertEqual(player.guardian.first_name, "Rosa")

    # ------------------------------------------------------------- entrenadores
    def test_coach_cannot_coach_two_teams_of_same_tournament(self):
        coach = self.team.coaches.first()
        res = self.api(self.admin).patch(f"/api/coaches/{coach.id}/", {"team": self.rival.id}, format="json")
        self.assertEqual(res.status_code, 400)
        self.assertIn("Copa A", str(res.data["team"]))
        # Libre de torneos compartidos, sí puede cambiar de equipo
        other = Team.objects.create(name="Pumas", vat_id="J", vat_number="40999888", state="Lara",
                                    municipality="Iribarren", address="Calle 3")
        res = self.api(self.admin).patch(f"/api/coaches/{coach.id}/", {"team": other.id}, format="json")
        self.assertEqual(res.status_code, 200, res.data)

    def test_manager_cannot_take_coach_from_other_team(self):
        outsider = Team.objects.create(name="Pumas", vat_id="J", vat_number="40999777", state="Lara",
                                       municipality="Iribarren", address="Calle 3")
        coach = f.coach("Otro", "Técnico", team=outsider)  # sin torneos en común: solo cuenta el permiso
        res = self.api(self.manager).patch(f"/api/coaches/{coach.id}/", {"team": self.team.id}, format="json")
        self.assertEqual(res.status_code, 403)

    def test_coach_user_manages_team_roster(self):
        coach_user = f.user("dt", role=roles.COACH)
        Coach.objects.filter(team=self.rival).update(user=coach_user)
        player = f.player("Nuevo", "Fichaje", date(date.today().year - 10, 3, 3))
        res = self.api(coach_user).post("/api/roster/", {"registration": self.reg_rival_cup.id, "player": player.id},
                                        format="json")
        self.assertEqual(res.status_code, 201, res.data)
        other = f.player("Otro", "Fichaje", date(date.today().year - 10, 4, 4))
        res = self.api(coach_user).post("/api/roster/", {"registration": self.reg_team_cup.id, "player": other.id},
                                        format="json")
        self.assertEqual(res.status_code, 403)

    # ------------------------------------------------------------- categorías y permisos
    def test_category_birth_year_follows_current_year(self):
        category = Category(name="Sub 12", max_age=11)
        with mock.patch("apps.registry.models.today", return_value=date(2026, 3, 1)):
            self.assertEqual(category.birth_year_limit, 2015)
        with mock.patch("apps.registry.models.today", return_value=date(2030, 3, 1)):
            self.assertEqual(category.birth_year_limit, 2019)

    def test_default_roles_and_spanish_permission_labels(self):
        from django.contrib.auth.models import Group

        names = set(Group.objects.values_list("name", flat=True))
        self.assertTrue({roles.ADMIN, roles.REFEREE, roles.DELEGATE, roles.AUTHORITY, roles.HEAD_REFEREE,
                         roles.HEAD_DELEGATE, roles.COACH, roles.TEAM_MANAGER} <= names)
        self.assertNotIn("Consulta", names)
        perms = {p["code"]: p["label"] for p in self.api(self.admin).get("/api/permissions/").data}
        self.assertEqual(perms["registry.add_team"], "Crear equipos")
        self.assertEqual(perms["competition.close_match"], "Cerrar partidos")
