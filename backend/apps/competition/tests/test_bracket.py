"""Sorteo de grupos, configuración y llenado de la eliminación directa, y avance de ganadores."""
from collections import Counter

from django.core.management import call_command
from django.test import TestCase
from rest_framework.test import APIClient

from apps.accounts import roles
from apps.competition.models import Bracket, Match, Stage
from apps.competition.services import bracket as svc
from apps.core import factories as f
from apps.tournaments.models import Tournament


class BracketTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        call_command("seed_roles", verbosity=0)
        cls.authority = f.user("autoridad", role=roles.AUTHORITY)
        cls.cat = f.category()

    def setUp(self):
        self.api = APIClient()
        self.api.force_authenticate(self.authority)

    def tournament(self, teams: int, modality=Tournament.Modality.GROUPS_KNOCKOUT):
        t = f.tournament(f"Copa {Tournament.objects.count()}", categories=[self.cat], modality=modality)
        for i in range(teams):
            f.register(t, f.team(f"Equipo{t.pk}x{i}", self.cat, players=0), self.cat, with_roster=False)
        return t

    def post(self, action, t, **data):
        return self.api.post(f"/api/knockout/{action}/", {"tournament": t.id, "category": self.cat.id, **data}, format="json")

    def test_draw_is_balanced(self):
        t = self.tournament(10)
        self.assertEqual(self.post("draw-groups", t, groups=3).status_code, 201)
        sizes = sorted(Counter(t.registrations.values_list("group__name", flat=True)).values())
        self.assertEqual(sizes, [3, 3, 4])
        self.assertEqual(self.post("draw-groups", t, groups=6).status_code, 400)  # 10 equipos no alcanzan

    def test_options_and_bracket_creation(self):
        t = self.tournament(10)
        svc.draw_groups(t, self.cat.id, 3, self.authority)
        options = {o["stage"]: o for o in svc.bracket_options(t, self.cat.id)}
        self.assertEqual((options[Stage.QF]["per_group"], options[Stage.QF]["best_extra"]), (2, 2))
        self.assertNotIn(Stage.R16, options)  # 16 cupos > 10 equipos
        res = self.post("create-bracket", t, start_stage=Stage.QF)
        self.assertEqual(res.status_code, 201, res.data)
        ko = Match.objects.filter(tournament=t).exclude(stage=Stage.REGULAR)
        self.assertEqual(Counter(ko.values_list("stage", flat=True)), {Stage.QF: 4, Stage.SF: 2, Stage.FINAL: 1})
        for m in ko.filter(stage=Stage.QF):  # nadie se cruza con su propio grupo en la primera ronda
            home, away = m.home_source.split(" ", 1)[1], m.away_source.split(" ", 1)[1]
            self.assertFalse(home == away and home.startswith("Grupo"), (m.home_source, m.away_source))
        self.assertTrue(ko.get(stage=Stage.FINAL).home_source.startswith("Ganador Semifinal"))

    def test_fill_after_group_stage_and_advance(self):
        t = self.tournament(8)
        svc.draw_groups(t, self.cat.id, 2, self.authority)  # el sorteo ya crea el fixture de cada grupo
        self.assertEqual(Match.objects.filter(tournament=t, stage=Stage.REGULAR).count(), 12)  # 2 grupos de 4: 6 + 6
        svc.create_bracket(t, self.cat.id, Stage.SF, self.authority)
        self.assertEqual(self.post("fill", t).status_code, 400)  # grupos sin terminar
        for m in Match.objects.filter(tournament=t, stage=Stage.REGULAR):
            m.home_score, m.away_score, m.status = 1, 0, Match.Status.CLOSED
            m.save()
        res = self.post("fill", t)
        self.assertEqual(res.status_code, 200, res.data)
        semis = list(Match.objects.filter(tournament=t, stage=Stage.SF).order_by("bracket_position"))
        self.assertTrue(all(m.home_id and m.away_id for m in semis))
        self.assertTrue(Bracket.objects.get(tournament=t).filled_at)
        semis[0].winner = semis[0].home
        svc.advance_winner(semis[0])
        final = Match.objects.get(tournament=t, stage=Stage.FINAL)
        self.assertEqual(final.home_id, semis[0].home_id)

    def test_pure_knockout_with_byes(self):
        t = self.tournament(6, Tournament.Modality.KNOCKOUT)
        option = svc.bracket_options(t, self.cat.id)[0]
        self.assertEqual((option["stage"], option["byes"]), (Stage.QF, 2))
        svc.create_bracket(t, self.cat.id, Stage.QF, self.authority)
        self.assertEqual(Match.objects.filter(tournament=t, stage=Stage.QF).count(), 2)  # 2 cruces + 2 pases directos
        placed = Match.objects.filter(tournament=t, stage=Stage.SF)
        self.assertEqual(sum(bool(m.home_id) + bool(m.away_id) for m in placed), 2)

    def test_view_projects_current_leaders(self):
        t = self.tournament(8)
        svc.draw_groups(t, self.cat.id, 2, self.authority)
        svc.create_bracket(t, self.cat.id, Stage.SF, self.authority)
        res = self.api.get("/api/knockout/", {"tournament": t.id, "category": self.cat.id})
        self.assertEqual(res.status_code, 200)
        first = res.data["stages"][0]["matches"][0]
        self.assertEqual(first["home"]["source"], "1º Grupo A")
        self.assertIsNotNone(first["home"]["projected"])
