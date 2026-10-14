"""Lo que está en borrador se borra definitivamente; lo enviado o en curso, no."""
from datetime import date

from django.core.management import call_command
from django.db.models import ProtectedError
from django.test import TestCase
from rest_framework.test import APIClient

from apps.accounts import roles
from apps.competition.models import Bracket, Match, Matchday, Stage
from apps.competition.services.bracket import create_bracket, draw_groups
from apps.core import factories as f
from apps.core.exceptions import api_exception_handler
from apps.tournaments.models import Group, TeamPlayer, Tournament, TournamentTeam


class DraftDeletionTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        call_command("seed_roles", verbosity=0)
        cls.authority = f.user("autoridad", role=roles.AUTHORITY)
        cls.cat = f.category()

    def setUp(self):
        self.api = APIClient()
        self.api.force_authenticate(self.authority)

    def build(self, status=Tournament.Status.DRAFT):
        tournament = f.tournament(f"Copa {Tournament.objects.count()}", categories=[self.cat])
        Tournament.objects.filter(pk=tournament.pk).update(status=status)
        group = Group.objects.create(tournament=tournament, category=self.cat, name="Grupo A")
        home = f.register(tournament, f.team(f"Halcones {tournament.pk}", self.cat, players=2), self.cat, group)
        away = f.register(tournament, f.team(f"Lobos {tournament.pk}", self.cat, players=2), self.cat, group)
        matchday = Matchday.objects.create(tournament=tournament, number=1, date=date.today())
        Match.objects.create(tournament=tournament, category=self.cat, home=home, away=away, matchday=matchday)
        return tournament

    def test_draft_tournament_is_deleted_with_everything(self):
        tournament = self.build()
        res = self.api.delete(f"/api/tournaments/{tournament.id}/")
        self.assertEqual(res.status_code, 204, getattr(res, "data", None))
        self.assertFalse(Tournament.objects.filter(pk=tournament.pk).exists())
        for model in (Match, Matchday, TournamentTeam, TeamPlayer, Group):
            self.assertFalse(model.objects.filter(tournament=tournament.pk).exists(), model.__name__)

    def test_draft_tournament_with_knockout_bracket_is_deleted(self):
        tournament = f.tournament("Copa con llave", categories=[self.cat], modality=Tournament.Modality.GROUPS_KNOCKOUT)
        Tournament.objects.filter(pk=tournament.pk).update(status=Tournament.Status.DRAFT)
        for i in range(8):
            f.register(tournament, f.team(f"Equipo llave {i}", self.cat, players=0), self.cat, with_roster=False)
        draw_groups(tournament, self.cat.id, 2, self.authority)
        create_bracket(tournament, self.cat.id, Stage.QF, self.authority)
        self.assertTrue(Bracket.objects.filter(tournament=tournament).exists())
        res = self.api.delete(f"/api/tournaments/{tournament.id}/")
        self.assertEqual(res.status_code, 204, getattr(res, "data", None))
        self.assertFalse(Bracket.objects.filter(tournament=tournament.pk).exists())
        self.assertFalse(Tournament.objects.filter(pk=tournament.pk).exists())

    def test_protected_delete_returns_409_instead_of_500(self):
        tournament = self.build()
        exc = ProtectedError("bloqueado", {Matchday.objects.get(tournament=tournament)})
        res = api_exception_handler(exc, {})
        self.assertEqual(res.status_code, 409)
        self.assertIn("jornadas", res.data["detail"])

    def test_published_tournament_cannot_be_deleted(self):
        tournament = self.build(Tournament.Status.REGISTRATION)
        self.assertEqual(self.api.delete(f"/api/tournaments/{tournament.id}/").status_code, 400)

    def test_tournament_with_submitted_matchday_cannot_be_deleted(self):
        tournament = self.build()
        Matchday.objects.filter(tournament=tournament).update(status=Matchday.Status.SUBMITTED)
        self.assertEqual(self.api.delete(f"/api/tournaments/{tournament.id}/").status_code, 400)
        self.assertTrue(Tournament.objects.filter(pk=tournament.pk).exists())
