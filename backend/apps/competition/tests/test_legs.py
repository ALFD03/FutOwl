"""Ida y vuelta: fixture de grupos automático y llave con cruces de dos partidos definidos por el global."""
from types import SimpleNamespace

from django.core.management import call_command
from django.test import TestCase
from rest_framework.test import APIClient

from apps.accounts import roles
from apps.competition.models import Leg, Match, Stage
from apps.competition.services import bracket as svc
from apps.competition.services import reports
from apps.core import factories as f
from apps.tournaments.models import Tournament


def finish(match: Match, home: int, away: int) -> Match:
    """Deja el partido finalizado con su marcador (sin pasar por la mesa técnica)."""
    Match.objects.filter(pk=match.pk).update(status=Match.Status.FINISHED, home_score=home, away_score=away)
    return Match.objects.get(pk=match.pk)


class LegsTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        call_command("seed_roles", verbosity=0)
        cls.authority = f.user("autoridad", role=roles.AUTHORITY)
        cls.cat = f.category()

    def setUp(self):
        self.api = APIClient()
        self.api.force_authenticate(self.authority)

    def tournament(self, teams: int, modality=Tournament.Modality.GROUPS_KNOCKOUT, **options):
        t = f.tournament(f"Copa {Tournament.objects.count()}", categories=[self.cat], modality=modality, **options)
        for i in range(teams):
            f.register(t, f.team(f"Equipo{t.pk}x{i}", self.cat, players=0), self.cat, with_roster=False)
        return t

    def regular(self, t):
        return Match.objects.filter(tournament=t, stage=Stage.REGULAR)

    # ------------------------------------------------------------ grupos
    def test_draw_creates_double_round_fixture_when_configured(self):
        t = self.tournament(8, groups_double=True)
        res = self.api.post("/api/knockout/draw-groups/", {"tournament": t.id, "category": self.cat.id, "groups": 2}, format="json")
        self.assertEqual(res.status_code, 201, res.data)
        self.assertEqual(res.data["matches"], 24)  # 2 grupos de 4: 12 partidos cada uno con ida y vuelta
        self.assertEqual(self.regular(t).count(), 24)

    def test_moving_a_team_rebuilds_both_groups_fixture(self):
        t = self.tournament(8)
        svc.draw_groups(t, self.cat.id, 2, self.authority)
        group_a, group_b = t.groups.order_by("name")
        reg = t.registrations.filter(group=group_a).first()
        res = self.api.patch(f"/api/registrations/{reg.id}/", {"group": group_b.id}, format="json")
        self.assertEqual(res.status_code, 200, res.data)
        self.assertEqual(self.regular(t).filter(group=group_a).count(), 3)   # quedan 3 equipos
        self.assertEqual(self.regular(t).filter(group=group_b).count(), 10)  # ahora son 5
        self.assertEqual(res.data["fixture"], {"created": 13, "kept": []})

    def test_scheduled_group_fixture_is_kept(self):
        t = self.tournament(8)
        svc.draw_groups(t, self.cat.id, 2, self.authority)
        group_a, group_b = t.groups.order_by("name")
        self.regular(t).filter(group=group_a).update(status=Match.Status.PENDING)
        reg = t.registrations.filter(group=group_a).first()
        res = self.api.patch(f"/api/registrations/{reg.id}/", {"group": group_b.id}, format="json")
        self.assertEqual(res.data["fixture"]["kept"], ["Grupo A"])
        self.assertEqual(self.regular(t).filter(group=group_a).count(), 6)

    # ------------------------------------------------------------ llave
    def test_double_bracket_creates_two_legs_and_single_final(self):
        t = self.tournament(4, Tournament.Modality.KNOCKOUT, knockout_double=True)
        svc.create_bracket(t, self.cat.id, Stage.SF, self.authority)
        semis = Match.objects.filter(tournament=t, stage=Stage.SF)
        self.assertEqual(semis.count(), 4)
        first, second = semis.filter(bracket_position=1).order_by("leg")
        self.assertEqual((first.leg, second.leg), (Leg.FIRST, Leg.SECOND))
        self.assertEqual((first.home_id, first.away_id), (second.away_id, second.home_id))  # localía invertida
        self.assertEqual(Match.objects.filter(tournament=t, stage=Stage.FINAL).count(), 1)
        final = Match.objects.get(tournament=t, stage=Stage.FINAL)
        self.assertIsNone(final.leg)
        view = self.api.get("/api/knockout/", {"tournament": t.id, "category": self.cat.id}).data
        self.assertEqual(len(view["stages"][0]["matches"]), 2)
        self.assertEqual(len(view["stages"][0]["matches"][0]["legs"]), 2)

    def test_double_final_when_not_single(self):
        t = self.tournament(4, Tournament.Modality.KNOCKOUT, knockout_double=True, final_single=False)
        svc.create_bracket(t, self.cat.id, Stage.SF, self.authority)
        self.assertEqual(Match.objects.filter(tournament=t, stage=Stage.FINAL).count(), 2)

    def test_aggregate_decides_the_tie_and_advances(self):
        t = self.tournament(4, Tournament.Modality.KNOCKOUT, knockout_double=True)
        svc.create_bracket(t, self.cat.id, Stage.SF, self.authority)
        first, second = Match.objects.filter(tournament=t, stage=Stage.SF, bracket_position=1).order_by("leg")
        team_a, team_b = first.home_id, first.away_id
        with self.assertRaises(Exception):  # la vuelta no se cierra antes que la ida
            reports.close_match(finish(second, 0, 0), self.authority)
        Match.objects.filter(pk=second.pk).update(status=Match.Status.DRAFT)

        # Ida 3-1 para A; vuelta (B local) 2-0 para B → global 3-3 → penales obligatorios
        first = finish(first, 3, 1)
        self._close(first)
        self.assertIsNone(Match.objects.get(pk=first.pk).winner_id)
        second = finish(Match.objects.get(pk=second.pk), 2, 0)
        with self.assertRaises(Exception):
            self._close(second)
        self._close(second, winner_side="away")  # ganó A (visitante en la vuelta) por penales
        second.refresh_from_db()
        self.assertEqual(second.winner_id, team_a)
        final = Match.objects.get(tournament=t, stage=Stage.FINAL)
        self.assertEqual(final.home_id, team_a)
        self.assertNotEqual(team_b, team_a)

    def test_fill_places_teams_in_both_legs(self):
        t = self.tournament(8, knockout_double=True)
        svc.draw_groups(t, self.cat.id, 2, self.authority)
        svc.create_bracket(t, self.cat.id, Stage.SF, self.authority)
        self.regular(t).update(status=Match.Status.CLOSED, home_score=1, away_score=0)
        svc.fill_bracket(t, self.cat.id, self.authority)
        for position in (1, 2):
            first, second = Match.objects.filter(tournament=t, stage=Stage.SF, bracket_position=position).order_by("leg")
            self.assertTrue(first.home_id and first.away_id)
            self.assertEqual((first.home_id, first.away_id), (second.away_id, second.home_id))

    def test_bracket_fills_itself_as_groups_finish(self):
        t = self.tournament(8)
        svc.draw_groups(t, self.cat.id, 2, self.authority)
        svc.create_bracket(t, self.cat.id, Stage.SF, self.authority)  # 1º A vs 2º B y 1º B vs 2º A
        group_a, group_b = t.groups.order_by("name")
        semis = lambda: list(Match.objects.filter(tournament=t, stage=Stage.SF).order_by("bracket_position"))  # noqa: E731

        for m in self.regular(t).filter(group=group_a):
            self._close(finish(m, 2, 0))
        placed = {reg for m in semis() for reg in (m.home_id, m.away_id) if reg}
        a_teams = set(t.registrations.filter(group=group_a).values_list("id", flat=True))
        self.assertEqual(len(placed), 2)  # el 1º y el 2º del Grupo A ya están en la llave
        self.assertTrue(placed <= a_teams)
        self.assertIsNone(t.brackets.get().filled_at)

        for m in self.regular(t).filter(group=group_b):
            self._close(finish(m, 1, 1))
        self.assertTrue(all(m.home_id and m.away_id for m in semis()))
        self.assertIsNotNone(t.brackets.get().filled_at)

    def test_bracket_created_after_groups_is_filled_at_once(self):
        t = self.tournament(8)
        svc.draw_groups(t, self.cat.id, 2, self.authority)
        self.regular(t).update(status=Match.Status.CLOSED, home_score=1, away_score=0)
        svc.create_bracket(t, self.cat.id, Stage.SF, self.authority)
        self.assertTrue(all(m.home_id and m.away_id for m in Match.objects.filter(tournament=t, stage=Stage.SF)))

    def _close(self, match, winner_side=None):
        # Atajo: el cierre exige informes coincidentes; aquí se prueba solo la lógica del ganador.
        from unittest import mock
        with mock.patch.object(reports, "compare", return_value={"both_submitted": True, "coincide": True,
                                                                   "delegate_report_id": None, "referee_report_id": None}), \
                mock.patch.object(reports.MatchReport.objects, "get",
                                  return_value=SimpleNamespace(home_score=match.home_score, away_score=match.away_score)), \
                mock.patch.object(reports.MatchClosure.objects, "create", return_value=None), \
                mock.patch.object(reports, "notify"):
            return reports.close_match(match, self.authority, winner_side=winner_side)
