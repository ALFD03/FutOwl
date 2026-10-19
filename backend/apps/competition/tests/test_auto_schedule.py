"""Generación automática de jornadas: días de juego, horario y capacidad de cada cancha y orden del fixture."""
from collections import Counter
from itertools import count
from datetime import date, datetime, time, timedelta

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
TEAM_NUMBERS = count()


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
        no_days = self.run_schedule(t, fields=[{"id": self.field.id, "start": "09:00", "end": "18:00", "days": []}])
        self.assertEqual(no_days.status_code, 400)
        self.assertIn("Cancha 1", str(no_days.data))
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

    def test_each_field_says_which_weekdays_it_can_be_used(self):
        t = self.tournament(6)
        sunday_field = f.field("Cancha Domingo")
        t.fields.add(sunday_field)
        self.api.post("/api/matches/generate-fixture/", {"tournament": t.id, "category": self.cat.id}, format="json")
        body = {"tournament": t.id, "start_date": OPENING.isoformat(), "fields": [
            {"id": self.field.id, "start": "09:00", "end": "18:00", "days": [SATURDAY]},
            {"id": sunday_field.id, "start": "09:00", "end": "18:00", "days": [SATURDAY + 1]},
        ]}
        res = self.api.post("/api/matchdays/auto-schedule/", body, format="json")
        self.assertEqual(res.status_code, 200, res.data)
        days = res.data["days"]
        self.assertEqual([d["date"] for d in days[:2]], ["2026-11-07", "2026-11-08"])  # sábado y domingo
        for day in days:
            expected = "Cancha 1" if date.fromisoformat(day["date"]).weekday() == SATURDAY else "Cancha Domingo"
            self.assertEqual({m["field"] for m in day["matches"]}, {expected})

    def test_by_default_every_weekday_is_a_play_day(self):
        t = self.tournament(4)
        self.api.post("/api/matches/generate-fixture/", {"tournament": t.id, "category": self.cat.id}, format="json")
        res = self.api.post("/api/matchdays/auto-schedule/", {"tournament": t.id, "start_date": OPENING.isoformat()},
                            format="json")
        self.assertEqual(res.status_code, 200, res.data)
        # Una fecha (2 partidos) por semana, repartida en sus primeros días: sábado y domingo de cada semana.
        self.assertEqual([d["date"] for d in res.data["days"]],
                         ["2026-11-07", "2026-11-08", "2026-11-14", "2026-11-15", "2026-11-21", "2026-11-22"])
        self.assertEqual([len(d["matches"]) for d in res.data["days"]], [1] * 6)

    def weekend(self, t, start="09:00", end="18:00"):
        return self.api.post("/api/matchdays/auto-schedule/", {"tournament": t.id, "start_date": OPENING.isoformat(), "fields": [
            {"id": self.field.id, "start": start, "end": end, "days": [SATURDAY, SATURDAY + 1]}]}, format="json")

    def test_one_round_per_week_spread_evenly_over_its_days(self):
        t = self.tournament(8)
        self.api.post("/api/matches/generate-fixture/", {"tournament": t.id, "category": self.cat.id}, format="json")
        res = self.weekend(t)
        self.assertEqual(res.data["unscheduled"], 0, res.data)
        round_of = dict(Match.objects.filter(tournament=t).values_list("id", "round_number"))
        for day in res.data["days"]:
            week = (date.fromisoformat(day["date"]) - OPENING).days // 7 + 1
            self.assertEqual(day["week"], week)
            self.assertEqual({round_of[m["id"]] for m in day["matches"]}, {week})  # fecha k en la semana k
            self.assertEqual(len(day["matches"]), 2)  # 4 partidos por fecha: 2 el sábado y 2 el domingo
        self.assertEqual(len(res.data["days"]), 14)  # 7 fechas × 2 días

    def test_a_team_plays_once_a_week_and_leftovers_go_first_next_week(self):
        t = self.tournament(6)
        self.api.post("/api/matches/generate-fixture/", {"tournament": t.id, "category": self.cat.id}, format="json")
        # 9:00 a 9:00 (+30'): un partido de 35' por día → 2 por semana; cada fecha tiene 3.
        res = self.weekend(t, "09:00", "09:05")
        self.assertEqual(res.data["unscheduled"], 0, res.data)
        by_week = {}
        for day in res.data["days"]:
            by_week.setdefault(day["week"], []).extend(day["matches"])
        for matches in by_week.values():
            teams = Counter(team for m in matches for team in (m["home"], m["away"]))
            self.assertEqual(max(teams.values()), 1)  # nadie juega dos veces en la semana
        round_of = dict(Match.objects.filter(tournament=t).values_list("id", "round_number"))
        self.assertEqual(sorted(round_of[m["id"]] for m in by_week[1]), [1, 1])
        self.assertEqual(round_of[by_week[2][0]["id"]], 1)  # el que no cupo de la fecha 1 va primero

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



class PlaySizeCapacityTests(TestCase):
    """La capacidad de una cancha divisible depende de las medidas de juego de cada categoría."""

    @classmethod
    def setUpTestData(cls):
        call_command("seed_roles", verbosity=0)
        cls.authority = f.user("autoridad", role=roles.AUTHORITY)
        cls.sub6 = f.category("Sub 6", 5, match_duration_minutes=30, periods=2, break_minutes=5,
                              play_length_m=30, play_width_m=25)
        cls.sub12 = f.category("Sub 12", 11, match_duration_minutes=30, periods=2, break_minutes=5,
                               play_length_m=64, play_width_m=50)
        cls.big = f.field("Grande", divisible=True)  # 100 × 64

    def test_capacity_depends_on_category_play_size(self):
        self.assertEqual(self.big.capacity_for(self.sub6), 8)  # 4 × 2 (o 3 × 2 girada): 8
        self.assertEqual(self.big.capacity_for(self.sub12), 2)  # 64 × 50 girada: 2 × 1
        not_divisible = f.field("Fija")
        self.assertEqual(not_divisible.capacity_for(self.sub6), 1)
        self.assertEqual(f.field("Chica", divisible=True, length=40, width=20).capacity_for(self.sub12), 1)
        self.assertEqual(self.big.capacity_for(f.category("Sub 18", 17)), 1)  # sin medidas: cancha completa

    def test_tournament_can_adjust_play_size(self):
        from apps.tournaments.models import CategoryRules

        t = f.tournament(categories=[self.sub6], fields=[self.big])
        CategoryRules.objects.create(tournament=t, category=self.sub6, play_length_m=50, play_width_m=32)
        self.assertEqual(self.big.capacity_for(t.rules_for(self.sub6)), 4)

    def match(self, t, category, start, minutes=35):
        from django.utils import timezone

        n = next(TEAM_NUMBERS)
        home = f.register(t, f.team(f"L{n}", category, players=0), category, with_roster=False)
        away = f.register(t, f.team(f"V{n}", category, players=0), category, with_roster=False)
        start = timezone.make_aware(datetime.combine(OPENING, start))
        return Match(tournament=t, category=category, home=home, away=away, field=self.big,
                     scheduled_start=start, scheduled_end=start + timedelta(minutes=minutes))

    def test_categories_share_the_field_by_occupied_fraction(self):
        from django.core.exceptions import ValidationError

        from apps.competition.services.scheduling import validate_schedule

        t = f.tournament("Mixto", categories=[self.sub6, self.sub12], fields=[self.big])
        half = self.match(t, self.sub12, time(9, 0))
        validate_schedule(half)
        half.save()
        self.assertEqual(half.sub_field, 1)
        for expected in (1, 2, 3, 4):  # la otra media cancha: 4 partidos de Sub 6
            small = self.match(t, self.sub6, time(9, 0))
            validate_schedule(small)
            small.save()
            self.assertEqual(small.sub_field, expected)
        with self.assertRaises(ValidationError):
            validate_schedule(self.match(t, self.sub6, time(9, 0)))
        with self.assertRaises(ValidationError):
            validate_schedule(self.match(t, self.sub12, time(9, 20)))
        later = self.match(t, self.sub12, time(9, 35))  # cuando terminan los anteriores sí entra
        validate_schedule(later)

    def test_auto_schedule_fits_eight_small_matches_at_once(self):
        t = f.tournament("Sub 6", categories=[self.sub6], fields=[self.big])
        Tournament.objects.filter(pk=t.pk).update(start_date=OPENING, end_date=OPENING + timedelta(days=180))
        for i in range(16):
            f.register(t, f.team(f"S{i}", self.sub6, players=0), self.sub6, with_roster=False)
        api = APIClient()
        api.force_authenticate(self.authority)
        api.post("/api/matches/generate-fixture/", {"tournament": t.id, "category": self.sub6.id}, format="json")
        res = api.post("/api/matchdays/auto-schedule/", {"tournament": t.id, "start_date": OPENING.isoformat(),
                                                         "days": [SATURDAY]}, format="json")
        self.assertEqual(res.status_code, 200, res.data)
        first = res.data["days"][0]["matches"]
        self.assertEqual(len(first), 8)  # 16 equipos → 8 partidos por fecha, todos a las 9:00
        self.assertEqual({m["start"][11:16] for m in first}, {"09:00"})
        self.assertEqual(sorted(m["sub_field"] for m in first), list(range(1, 9)))

    def test_each_field_keeps_the_same_capacity_all_day(self):
        second = f.field("Grande 2", divisible=True)
        t = f.tournament("Misma capacidad", categories=[self.sub6, self.sub12], fields=[self.big, second])
        Tournament.objects.filter(pk=t.pk).update(start_date=OPENING, end_date=OPENING + timedelta(days=180))
        api = APIClient()
        api.force_authenticate(self.authority)
        for category in (self.sub6, self.sub12):
            for i in range(8):
                f.register(t, f.team(f"{category.name}-{i}", category, players=0), category, with_roster=False)
            api.post("/api/matches/generate-fixture/", {"tournament": t.id, "category": category.id}, format="json")

        def plan(**extra):
            res = api.post("/api/matchdays/auto-schedule/", {"tournament": t.id, "start_date": OPENING.isoformat(),
                                                             "days": [SATURDAY], **extra}, format="json")
            self.assertEqual(res.status_code, 200, res.data)
            return res.data["days"]

        for day in plan():
            by_field = {}
            for m in day["matches"]:
                by_field.setdefault(m["field"], set()).add(m["category"])
            self.assertTrue(all(len(c) == 1 for c in by_field.values()), by_field)  # 8 de Sub 6 o 2 de Sub 12
            self.assertEqual({(x["field"], x["at_once"]) for x in day["fields"]},
                             {(name, 8 if cats == {"Sub 6"} else 2) for name, cats in by_field.items()})
        first = plan()[0]
        self.assertEqual({m["category"] for m in first["matches"]}, {"Sub 6", "Sub 12"})  # una cancha para cada una
        # Sin la regla, el generador puede mezclar categorías en una misma cancha.
        mixed = plan(same_capacity=False)[0]
        self.assertEqual(len(mixed["matches"]), 8)
