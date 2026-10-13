"""Lo que está en borrador se borra definitivamente; lo enviado o en curso, no."""
from datetime import date

from django.core.management import call_command
from django.test import TestCase
from rest_framework.test import APIClient

from apps.accounts import roles
from apps.competition.models import Match, Matchday
from apps.core import factories as f
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

    def test_published_tournament_cannot_be_deleted(self):
        tournament = self.build(Tournament.Status.REGISTRATION)
        self.assertEqual(self.api.delete(f"/api/tournaments/{tournament.id}/").status_code, 400)

    def test_tournament_with_submitted_matchday_cannot_be_deleted(self):
        tournament = self.build()
        Matchday.objects.filter(tournament=tournament).update(status=Matchday.Status.SUBMITTED)
        self.assertEqual(self.api.delete(f"/api/tournaments/{tournament.id}/").status_code, 400)
        self.assertTrue(Tournament.objects.filter(pk=tournament.pk).exists())
