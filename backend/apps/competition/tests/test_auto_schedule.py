"""Generación automática de jornadas: días de juego, hora de inicio, máximo por cancha y orden del fixture."""
from collections import Counter
from datetime import date, timedelta

from django.core.management import call_command
from django.db import connection
from django.test.utils import CaptureQueriesContext
from django.test import TestCase
from rest_framework.test import APIClient

from apps.accounts import roles
from apps.competition.models import Leg, Match, Matchday, Stage
from apps.competition.services import bracket
from apps.core import factories as f
from apps.tournaments.models import Tournament

SATURDAY = 5
OPENING = date(2026, 11, 7)  # sábado


class AutoScheduleTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        call_command("seed_roles", verbosity=0)
        cls.authority = f.user("autoridad", role=roles.AUTHORITY)
        cls.cat = f.category(match_duration_minutes=30, periods=2, break_minutes=5)  # 35' por partido
        cls.field = f.field("Cancha 1")

    def setUp(self):
        self.api = APIClient()
        self.api.force_authenticate(self.authority)

    def tournament(self, teams, modality=Tournament.Modality.LEAGUE, **options):
        t = f.tournament(f"Copa {Tournament.objects.count()}", categories=[self.cat], fields=[self.field], modality=modality, **options)
        Tournament.objects.filter(pk=t.pk).update(start_date=OPENING, end_date=OPENING + timedelta(days=180))
        t.refresh_from_db()
        for i in range(teams):
            f.register(t, f.team(f"E{t.pk}x{i}", self.cat, players=0), self.cat, with_roster=False)
        return t

    def run_schedule(self, t, commit=False, **extra):
        body = {"tournament": t.id, "start_date": OPENING.isoformat(), "days": [SATURDAY], "commit": commit, **extra}
        return self.api.post("/api/matchdays/auto-schedule/", body, format="json")

    def test_preview_covers_all_matches_without_saving(self):
        t = self.tournament(6)
        self.api.post("/api/matches/generate-fixture/", {"tournament": t.id, "category": self.cat.id}, format="json")
        # Cancha de 9:00 a 10:00: con el margen de 30' el último puede terminar 10:30 → 2 partidos de 35' por día.
        res = self.run_schedule(t, fields=[{"id": self.field.id, "start": "09:00", "end": "10:00"}])
        self.assertEqual(res.status_code, 200, res.data)
        self.assertEqual((res.data["total"], res.data["scheduled"], res.data["unscheduled"]), (15, 15, 0))
        first = res.data["days"][0]
        self.assertEqual((first["date"], first["start"], len(first["matches"])), ("2026-11-07", "09:00", 2))
        # Encadenados con la duración de la categoría: 09:00–09:35 y 09:35–10:10 (el de 10:10–10:45 ya no entra)
        self.assertEqual([m["start"][11:16] for m in first["matches"]], ["09:00", "09:35"])
        for day in res.data["days"]:
            self.assertEqual(date.fromisoformat(day["date"]).weekday(), SATURDAY)
            teams = Counter(team for m in day["matches"] for team in (m["home"], m["away"]))
            self.assertEqual(max(teams.values()), 1)  # un partido por equipo y jornada
        self.assertFalse(Matchday.objects.filter(tournament=t).exists())

    def test_commit_creates_matchdays_with_schedule(self):
        t = self.tournament(4)
        self.api.post("/api/matches/generate-fixture/", {"tournament": t.id, "category": self.cat.id}, format="json")
        Matchday.objects.create(tournament=t, number=1, date=OPENING)  # ese sábado ya tiene jornada: se salta
        res = self.run_schedule(t, commit=True)
        self.assertEqual(res.status_code, 201, res.data)
        created = Matchday.objects.filter(tournament=t).exclude(number=1).order_by("number")
        self.assertEqual([md.date for md in created], [OPENING + timedelta(days=7 * k) for k in (1, 2, 3)])
        self.assertEqual(created.first().number, 2)
        for m in Match.objects.filter(tournament=t):
            self.assertIsNotNone(m.matchday_id)
            self.assertEqual(m.field_id, self.field.id)
            self.assertEqual((m.scheduled_end - m.scheduled_start), timedelta(minutes=35))

    def test_knockout_goes_after_groups_and_second_leg_after_first(self):
        t = self.tournament(8, Tournament.Modality.GROUPS_KNOCKOUT, knockout_double=True)
        bracket.draw_groups(t, self.cat.id, 2, self.authority)
        bracket.create_bracket(t, self.cat.id, Stage.SF, self.authority)
        res = self.run_schedule(t)
        self.assertEqual(res.data["unscheduled"], 0, res.data)
        day_of = {m["id"]: i for i, d in enumerate(res.data["days"]) for m in d["matches"]}
        regular_last = max(day_of[m.id] for m in Match.objects.filter(tournament=t, stage=Stage.REGULAR))
        for m in Match.objects.filter(tournament=t).exclude(stage=Stage.REGULAR):
            self.assertGreater(day_of[m.id], regular_last)
        for first in Match.objects.filter(tournament=t, leg=Leg.FIRST):
            second = Match.objects.get(tournament=t, stage=first.stage, bracket_position=first.bracket_position, leg=Leg.SECOND)
            self.assertGreater(day_of[second.id], day_of[first.id])
        final = Match.objects.get(tournament=t, stage=Stage.FINAL)
        semis = Match.objects.filter(tournament=t, stage=Stage.SF)
        self.assertGreater(day_of[final.id], max(day_of[m.id] for m in semis))

    def test_respects_field_already_busy_that_day(self):
        other = self.tournament(2)
        self.api.post("/api/matches/generate-fixture/", {"tournament": other.id, "category": self.cat.id}, format="json")
        busy = Match.objects.get(tournament=other)
        md = Matchday.objects.create(tournament=other, number=1, date=OPENING)
        Match.objects.filter(pk=busy.pk).update(matchday=md, field=self.field, scheduled_start="2026-11-07T09:00:00-04:00",
                                                scheduled_end="2026-11-07T10:00:00-04:00")
        t = self.tournament(2)
        self.api.post("/api/matches/generate-fixture/", {"tournament": t.id, "category": self.cat.id}, format="json")
        res = self.run_schedule(t)
        self.assertEqual(res.data["days"][0]["matches"][0]["start"][11:16], "10:00")

    def test_requires_days_and_valid_field_hours(self):
        t = self.tournament(4)
        self.assertEqual(self.run_schedule(t, days=[]).status_code, 400)
        bad = self.run_schedule(t, fields=[{"id": self.field.id, "start": "18:00", "end": "09:00"}])
        self.assertEqual(bad.status_code, 400)

    def test_last_match_may_end_up_to_30_minutes_after_the_limit(self):
        t = self.tournament(6)
        self.api.post("/api/matches/generate-fixture/", {"tournament": t.id, "category": self.cat.id}, format="json")
        res = self.run_schedule(t, fields=[{"id": self.field.id, "start": "17:00", "end": "18:00"}])
        first = res.data["days"][0]
        # 17:00–17:35 y 17:35–18:10 (≤ 18:30); 18:10–18:45 se pasa del margen
        self.assertEqual([(m["start"][11:16], m["end"][11:16]) for m in first["matches"]], [("17:00", "17:35"), ("17:35", "18:10")])
        self.assertEqual((first["start"], first["end"]), ("17:00", "18:10"))

    def test_default_hours_are_nine_to_six(self):
        t = self.tournament(4)
        self.api.post("/api/matches/generate-fixture/", {"tournament": t.id, "category": self.cat.id}, format="json")
        first = self.run_schedule(t).data["days"][0]
        self.assertEqual(first["start"], "09:00")

    def test_bulk_delete_matchdays_releases_their_matches(self):
        t = self.tournament(4)
        self.api.post("/api/matches/generate-fixture/", {"tournament": t.id, "category": self.cat.id}, format="json")
        self.run_schedule(t, commit=True)
        ids = list(Matchday.objects.filter(tournament=t).values_list("id", flat=True))
        Matchday.objects.filter(pk=ids[0]).update(status=Matchday.Status.SUBMITTED)  # enviada: se omite
        res = self.api.post("/api/matchdays/bulk-delete/", {"tournament": t.id, "ids": ids}, format="json")
        self.assertEqual(res.status_code, 200, res.data)
        self.assertEqual(res.data, {"deleted": len(ids) - 1, "skipped": 1})
        released = Match.objects.filter(tournament=t, matchday__isnull=True)
        self.assertEqual(released.count(), 4)  # 2 jornadas × 2 partidos
        self.assertFalse(released.exclude(field=None).exists())
        self.assertFalse(released.exclude(scheduled_start=None).exists())
        # Se pueden volver a generar sin choques con la programación anterior.
        again = self.run_schedule(t)
        self.assertEqual(again.data["unscheduled"], 0)

    def test_commit_uses_a_bounded_number_of_queries(self):
        # En Vercel la petición tiene 30 s: crear partido por partido (con su auditoría) no alcanzaba con ~1.600.
        counts = []
        for teams in (4, 10):
            t = self.tournament(teams)
            self.api.post("/api/matches/generate-fixture/", {"tournament": t.id, "category": self.cat.id}, format="json")
            with CaptureQueriesContext(connection) as ctx:
                res = self.run_schedule(t, commit=True)
            self.assertEqual(res.status_code, 201, res.data)
            self.assertEqual(Match.objects.filter(tournament=t, matchday__isnull=True).count(), 0)
            counts.append(len(ctx.captured_queries))
        # 6 partidos o 45 partidos: la cantidad de consultas casi no cambia (solo crece con los días).
        self.assertLess(counts[1] - counts[0], 25, counts)

