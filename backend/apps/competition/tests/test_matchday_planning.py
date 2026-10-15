"""Armado de la jornada: agregar varios partidos (opcionalmente en una cancha) y fin calculado por reglas."""
from datetime import date

from django.core.management import call_command
from django.test import TestCase
from rest_framework.test import APIClient

from apps.accounts import roles
from apps.competition.models import Match, Matchday, Stage
from apps.core import factories as f


class MatchdayPlanningTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        call_command("seed_roles", verbosity=0)
        cls.authority = f.user("autoridad", role=roles.AUTHORITY)
        cls.cat = f.category(match_duration_minutes=60, periods=2, break_minutes=10)
        cls.field = f.field()
        cls.tournament = f.tournament(categories=[cls.cat], fields=[cls.field])
        for i in range(4):
            f.register(cls.tournament, f.team(f"Equipo{i}", cls.cat, players=0), cls.cat, with_roster=False)

    def setUp(self):
        self.api = APIClient()
        self.api.force_authenticate(self.authority)
        self.api.post("/api/matches/generate-fixture/", {"tournament": self.tournament.id, "category": self.cat.id}, format="json")
        self.matchday = Matchday.objects.create(tournament=self.tournament, number=1, date=date(2026, 11, 7))

    def regular(self):
        return Match.objects.filter(tournament=self.tournament, stage=Stage.REGULAR).order_by("id")

    def test_add_matches_in_bulk_with_field(self):
        ids = list(self.regular().values_list("id", flat=True))[:3]
        Match.objects.filter(pk=ids[2]).update(status=Match.Status.PENDING)  # no es borrador: se omite
        res = self.api.post(f"/api/matchdays/{self.matchday.id}/add-matches/", {"ids": ids, "field": self.field.id}, format="json")
        self.assertEqual(res.status_code, 200, res.data)
        self.assertEqual(res.data, {"added": 2, "skipped": 1})
        added = Match.objects.filter(matchday=self.matchday)
        self.assertEqual(added.count(), 2)
        self.assertTrue(all(m.field_id == self.field.id for m in added))

    def test_only_start_is_needed_end_comes_from_rules(self):
        match = self.regular().first()
        self.api.post(f"/api/matchdays/{self.matchday.id}/add-matches/", {"ids": [match.id], "field": self.field.id}, format="json")
        res = self.api.patch(f"/api/matches/{match.id}/", {"scheduled_start": "2026-11-07T08:00:00-04:00", "sub_field": None}, format="json")
        self.assertEqual(res.status_code, 200, res.data)
        match.refresh_from_db()
        self.assertEqual((match.scheduled_end - match.scheduled_start).total_seconds() / 60, 70)  # 60' + 10' de descanso
        # Cambiar la cancha no borra el fin ya calculado.
        res = self.api.patch(f"/api/matches/{match.id}/", {"field": self.field.id, "sub_field": None}, format="json")
        self.assertEqual(res.status_code, 200, res.data)
        match.refresh_from_db()
        self.assertIsNotNone(match.scheduled_end)

    def test_cannot_add_to_submitted_matchday(self):
        Matchday.objects.filter(pk=self.matchday.pk).update(status=Matchday.Status.SUBMITTED)
        res = self.api.post(f"/api/matchdays/{self.matchday.id}/add-matches/", {"ids": [self.regular().first().id]}, format="json")
        self.assertEqual(res.status_code, 400)

    def test_matchday_date_must_be_reasonable_and_within_tournament(self):
        url = "/api/matchdays/"
        bad_year = self.api.post(url, {"tournament": self.tournament.id, "number": 2, "date": "0006-11-01"}, format="json")
        self.assertEqual(bad_year.status_code, 400)
        self.assertIn("año", str(bad_year.data["date"]))
        too_late = self.api.post(url, {"tournament": self.tournament.id, "number": 2, "date": "2030-01-01"}, format="json")
        self.assertEqual(too_late.status_code, 400)

    def test_changing_the_date_moves_matches_with_same_time(self):
        match = self.regular().first()
        self.api.post(f"/api/matchdays/{self.matchday.id}/add-matches/", {"ids": [match.id], "field": self.field.id}, format="json")
        self.api.patch(f"/api/matches/{match.id}/", {"scheduled_start": "2026-11-07T09:00:00-04:00", "sub_field": None}, format="json")
        res = self.api.patch(f"/api/matchdays/{self.matchday.id}/", {"date": "2026-11-14"}, format="json")
        self.assertEqual(res.status_code, 200, res.data)
        match.refresh_from_db()
        self.assertEqual(match.scheduled_start.isoformat(), "2026-11-14T13:00:00+00:00")  # 09:00 UTC-4
        self.assertEqual(match.scheduled_end.isoformat(), "2026-11-14T14:10:00+00:00")

    def test_fixing_a_mistyped_year_keeps_the_official_time(self):
        # Caso real: jornada guardada en el año 6; su hora local histórica no era UTC-4.
        match = self.regular().first()
        Matchday.objects.filter(pk=self.matchday.pk).update(date=date(6, 11, 1))
        self.api.post(f"/api/matchdays/{self.matchday.id}/add-matches/", {"ids": [match.id], "field": self.field.id}, format="json")
        self.api.patch(f"/api/matches/{match.id}/", {"scheduled_start": "0006-11-01T09:00:00-04:00", "sub_field": None}, format="json")
        res = self.api.patch(f"/api/matchdays/{self.matchday.id}/", {"date": "2026-11-07"}, format="json")
        self.assertEqual(res.status_code, 200, res.data)
        match.refresh_from_db()
        self.assertEqual(match.scheduled_start.isoformat(), "2026-11-07T13:00:00+00:00")

    def test_tournament_dates_reject_mistyped_years(self):
        res = self.api.patch(f"/api/tournaments/{self.tournament.id}/", {"start_date": "0026-01-01"}, format="json")
        self.assertEqual(res.status_code, 400)

