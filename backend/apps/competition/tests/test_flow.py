"""Prueba de extremo a extremo del flujo de una jornada (API REST)."""
from datetime import datetime, time, timedelta

from django.core.management import call_command
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from apps.accounts import roles
from apps.competition.models import Match, Matchday, MatchEvent, ReviewCase
from apps.core import factories as f


class MatchdayFlowTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        call_command("seed_roles", verbosity=0)
        cls.admin = f.user("admin", superuser=True)
        cls.authority = f.user("autoridad", role=roles.AUTHORITY)
        cls.delegate_user = f.user("delegado", role=roles.DELEGATE)
        cls.ref_users = [f.user(f"arbitro{i}", role=roles.REFEREE) for i in range(3)]
        cls.home_manager = f.user("gestor_local", role=roles.TEAM_MANAGER)
        cls.away_manager = f.user("gestor_visita", role=roles.TEAM_MANAGER)

        cls.cat = f.category()
        cls.field = f.field()
        cls.delegate = f.official("Delegate", "Ana", "Delegada", cls.delegate_user)
        cls.referees = [f.official("Referee", f"Árbitro{i}", "Pérez", u) for i, u in enumerate(cls.ref_users)]
        cls.home_team = f.team("Halcones FC", cls.cat, manager=cls.home_manager)
        cls.away_team = f.team("Lobos FC", cls.cat, manager=cls.away_manager)
        cls.tournament = f.tournament(categories=[cls.cat], fields=[cls.field], max_substitutions=3)
        cls.reg_home = f.register(cls.tournament, cls.home_team, cls.cat)
        cls.reg_away = f.register(cls.tournament, cls.away_team, cls.cat)

    def client_for(self, user):
        client = APIClient()
        client.force_authenticate(user)
        return client

    def schedule_match(self, start):
        api = self.client_for(self.authority)
        res = api.post("/api/matches/generate-fixture/", {"tournament": self.tournament.id, "category": self.cat.id},
                       format="json")
        self.assertEqual(res.status_code, 201, res.data)
        match = Match.objects.get(tournament=self.tournament)
        res = api.post("/api/matchdays/", {"tournament": self.tournament.id, "number": 1,
                                           "date": timezone.localtime(start).date()}, format="json")
        self.assertEqual(res.status_code, 201, res.data)
        matchday = Matchday.objects.get(pk=res.data["id"])
        payload = {"matchday": matchday.id, "field": self.field.id, "scheduled_start": start.isoformat(),
                   "delegate": self.delegate.id, "referee": self.referees[0].id,
                   "assistant_referee_1": self.referees[1].id, "assistant_referee_2": self.referees[2].id}
        res = api.patch(f"/api/matches/{match.id}/", payload, format="json")
        self.assertEqual(res.status_code, 200, res.data)
        return api, match, matchday

    def test_full_matchday_flow(self):
        start = timezone.make_aware(datetime.combine(timezone.localdate() + timedelta(days=2), time(9, 0)))
        api, match, matchday = self.schedule_match(start)

        # Envío de la jornada → partido pendiente de confirmación y bloqueado
        res = api.post(f"/api/matchdays/{matchday.id}/submit/")
        self.assertEqual(res.status_code, 200, res.data)
        match.refresh_from_db()
        self.assertEqual(match.status, Match.Status.PENDING)
        res = api.patch(f"/api/matches/{match.id}/", {"sub_field": 1}, format="json")
        self.assertEqual(res.status_code, 400)  # bloqueado: requiere ajuste

        # Un asistente rechaza → caso en revisión
        res = self.client_for(self.ref_users[2]).post(
            f"/api/matches/{match.id}/respond/", {"party": "assistant_2", "response": "rejected",
                                                  "reason": "Viaje familiar"}, format="json")
        self.assertEqual(res.status_code, 201, res.data)
        self.assertEqual(ReviewCase.objects.filter(match=match, status="open").count(), 1)

        # La autoridad reasigna con exposición de motivos (ajuste, versión 2)
        spare = f.official("Referee", "Suplente", "Gómez", f.user("arbitro_suplente", role=roles.REFEREE))
        res = api.post(f"/api/matches/{match.id}/adjust/", {"assistant_referee_2": spare.id,
                                                            "reason": "Reemplazo por rechazo justificado"},
                       format="json")
        self.assertEqual(res.status_code, 201, res.data)
        case = ReviewCase.objects.get(match=match)
        res = api.post(f"/api/review-cases/{case.id}/resolve/", {"status": "resolved",
                                                                 "resolution": "Árbitro reemplazado"}, format="json")
        self.assertEqual(res.status_code, 200, res.data)

        # Confirmaciones de delegado y terna
        for user, party in [(self.delegate_user, "delegate"), (self.ref_users[0], "referee"),
                            (self.ref_users[1], "assistant_1"), (spare.user, "assistant_2")]:
            res = self.client_for(user).post(f"/api/matches/{match.id}/respond/",
                                             {"party": party, "response": "accepted"}, format="json")
            self.assertEqual(res.status_code, 201, res.data)
        match.refresh_from_db()
        matchday.refresh_from_db()
        self.assertEqual(match.status, Match.Status.CONFIRMED)
        self.assertEqual(matchday.status, Matchday.Status.CONFIRMED)

        # Una vez confirmado no puede volver a responder
        res = self.client_for(self.delegate_user).post(f"/api/matches/{match.id}/respond/",
                                                       {"party": "delegate", "response": "rejected",
                                                        "reason": "x"}, format="json")
        self.assertEqual(res.status_code, 400)

        # Alineaciones de ambos equipos
        for manager, reg in [(self.home_manager, self.reg_home), (self.away_manager, self.reg_away)]:
            roster = list(reg.team.roster.all())
            players = [{"team_player": tp.id, "shirt_number": tp.shirt_number, "is_starter": i < 7,
                        "is_captain": i == 0} for i, tp in enumerate(roster)]
            res = self.client_for(manager).post(f"/api/matches/{match.id}/submit-lineup/",
                                                {"team": reg.id, "players": players}, format="json")
            self.assertEqual(res.status_code, 201, res.data)
        # Un gestor no puede cargar la alineación del rival
        res = self.client_for(self.home_manager).post(f"/api/matches/{match.id}/submit-lineup/",
                                                      {"team": self.reg_away.id, "players": []}, format="json")
        self.assertIn(res.status_code, (400, 403))

        # Mesa técnica
        dele = self.client_for(self.delegate_user)
        home_lineup = match.lineups.get(team=self.reg_home)
        starters = list(home_lineup.players.filter(is_starter=True).values_list("team_player_id", flat=True))
        bench = list(home_lineup.players.filter(is_starter=False).values_list("team_player_id", flat=True))

        def ev(**data):
            return dele.post(f"/api/matches/{match.id}/record-event/", data, format="json")

        self.assertEqual(ev(type="kickoff").status_code, 400)  # falta llegada del delegado
        self.assertEqual(ev(type="delegate_arrival").status_code, 201)
        for reg in (self.reg_home, self.reg_away):
            self.assertEqual(ev(type="team_arrival", team=reg.id).status_code, 201)
            self.assertEqual(ev(type="documents_verified", team=reg.id).status_code, 201)
        self.assertEqual(ev(type="kickoff").status_code, 201)
        res = ev(type="goal", team=self.reg_home.id, player=starters[0], minute=10)
        self.assertEqual(res.status_code, 201, res.data)
        wrong_goal = ev(type="goal", team=self.reg_home.id, player=starters[1], minute=12).data[0]["id"]
        self.assertEqual(ev(type="annulment", annuls=wrong_goal, notes="Fuera de juego").status_code, 201)
        self.assertEqual(ev(type="annulment", annuls=wrong_goal, notes="Otra vez").status_code, 400)
        self.assertEqual(ev(type="goal", team=self.reg_home.id, player=bench[0]).status_code, 400)  # en banco
        self.assertEqual(ev(type="substitution", team=self.reg_home.id, player=starters[2],
                            player_in=bench[0]).status_code, 201)
        res = ev(type="yellow_card", team=self.reg_home.id, player=starters[3])
        res = ev(type="yellow_card", team=self.reg_home.id, player=starters[3])
        self.assertEqual(len(res.data), 2)  # doble amarilla → roja automática
        self.assertEqual(ev(type="period_end").status_code, 201)
        self.assertEqual(ev(type="period_start").status_code, 201)
        self.assertEqual(ev(type="match_end").status_code, 201)

        state = dele.get(f"/api/matches/{match.id}/state/").data
        self.assertEqual((state["home_score"], state["away_score"]), (1, 0))

        # Informes: el árbitro se equivoca, la autoridad lo devuelve y luego coinciden
        dele.post(f"/api/matches/{match.id}/submit-report/", {"role": "delegate", "home_score": 1, "away_score": 0,
                                                              "home_yellow": 2, "home_red": 1}, format="json")
        ref = self.client_for(self.ref_users[0])
        res = ref.post(f"/api/matches/{match.id}/submit-report/", {"role": "referee", "home_score": 2,
                                                                   "away_score": 0, "home_yellow": 2, "home_red": 1},
                       format="json")
        self.assertEqual(res.status_code, 201, res.data)
        self.assertEqual(api.post(f"/api/matches/{match.id}/close/").status_code, 400)
        res = api.post(f"/api/matches/{match.id}/return-report/", {"report": res.data["id"],
                                                                   "reason": "Marcador incorrecto"}, format="json")
        self.assertEqual(res.status_code, 200, res.data)
        res = ref.post(f"/api/matches/{match.id}/submit-report/", {"role": "referee", "home_score": 1,
                                                                   "away_score": 0, "home_yellow": 2, "home_red": 1},
                       format="json")
        self.assertEqual(res.data["version"], 2)
        res = api.post(f"/api/matches/{match.id}/close/")
        self.assertEqual(res.status_code, 200, res.data)
        self.assertEqual(res.data["status"], Match.Status.CLOSED)

        # Cierre de jornada, posiciones y API pública
        self.assertEqual(api.post(f"/api/matchdays/{matchday.id}/close/").status_code, 200)
        table = APIClient().get(f"/api/public/tournaments/{self.tournament.id}/standings/",
                                {"category": self.cat.id}).data
        self.assertEqual(table[0]["team"], "Halcones FC")
        self.assertEqual(table[0]["points"], 3)
        public = APIClient().get(f"/api/public/matches/{match.id}/").data
        self.assertTrue(all(e["type"] in MatchEvent.PUBLIC_TYPES for e in public["events"]))
        self.assertNotIn("vat_number", str(public))

        # Tras el cierre: sin eventos nuevos, solo notas/apelaciones
        self.assertEqual(ev(type="note", notes="tarde").status_code, 400)
        res = self.client_for(self.away_manager).post(f"/api/matches/{match.id}/add-note/",
                                                      {"kind": "appeal", "body": "Alineación indebida"},
                                                      format="json")
        self.assertEqual(res.status_code, 201, res.data)
        self.assertTrue(ReviewCase.objects.filter(kind="appeal", match=match).exists())

    def test_field_overlap_respects_capacity(self):
        start = timezone.make_aware(datetime.combine(timezone.localdate() + timedelta(days=3), time(10, 0)))
        api, match, matchday = self.schedule_match(start)
        third = f.team("Tigres FC", self.cat)
        reg3 = f.register(self.tournament, third, self.cat)
        fourth = f.register(self.tournament, f.team("Pumas FC", self.cat), self.cat)
        res = api.post("/api/matches/", {"tournament": self.tournament.id, "category": self.cat.id, "home": reg3.id,
                                         "away": fourth.id, "field": self.field.id,
                                         "scheduled_start": (start + timedelta(minutes=30)).isoformat()},
                       format="json")
        self.assertEqual(res.status_code, 400)
        self.assertIn("field", res.data)
        # Con una cancha divisible en 2 sí se permite
        self.field.is_divisible, self.field.mini_fields_count = True, 2
        self.field.save()
        res = api.post("/api/matches/", {"tournament": self.tournament.id, "category": self.cat.id, "home": reg3.id,
                                         "away": fourth.id, "field": self.field.id,
                                         "scheduled_start": (start + timedelta(minutes=30)).isoformat()},
                       format="json")
        self.assertEqual(res.status_code, 201, res.data)
        self.assertEqual(Match.objects.get(pk=res.data["id"]).sub_field, 2)

    def test_permissions_are_enforced(self):
        viewer = f.user("consulta", role=roles.VIEWER)
        api = self.client_for(viewer)
        self.assertEqual(api.get("/api/teams/").status_code, 200)
        self.assertEqual(api.post("/api/categories/", {"name": "Sub 15", "max_age": 14,
                                                       "birth_year_limit": 2012}).status_code, 403)
        self.assertEqual(api.post("/api/matches/generate-fixture/", {}).status_code, 403)
        self.assertEqual(APIClient().get("/api/teams/").status_code, 401)
