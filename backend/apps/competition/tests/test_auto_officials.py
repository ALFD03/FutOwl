"""Asignación automática de oficiales: una cancha por día, nunca dos partidos a la vez y carga pareja."""
from collections import Counter, defaultdict
from datetime import datetime, time, timedelta

from django.core.management import call_command
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from apps.accounts import roles
from apps.competition.models import Match, Matchday
from apps.competition.services.scheduling import REFEREE_FIELDS
from apps.core import factories as f
from apps.notifications.models import Notification
from apps.registry.models import Delegate, Referee

POSITIONS = ["delegate", *REFEREE_FIELDS]


class AutoAssignOfficialsTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        call_command("seed_roles", verbosity=0)
        cls.authority = f.user("autoridad", role=roles.AUTHORITY)
        cls.head_delegate = f.user("jefe_delegados", role=roles.HEAD_DELEGATE)
        cls.head_referee = f.user("jefe_arbitros", role=roles.HEAD_REFEREE)
        cls.cat = f.category(referees_required=3)
        cls.fields = [f.field("Cancha A"), f.field("Cancha B")]
        cls.tournament = f.tournament(categories=[cls.cat], fields=cls.fields)
        cls.home = f.register(cls.tournament, f.team("Halcones FC", cls.cat, players=0), cls.cat, with_roster=False)
        cls.away = f.register(cls.tournament, f.team("Lobos FC", cls.cat, players=0), cls.cat, with_roster=False)
        cls.day = timezone.localdate() + timedelta(days=3)
        cls.matchday = Matchday.objects.create(tournament=cls.tournament, number=1, date=cls.day,
                                               status=Matchday.Status.SUBMITTED)

    def setUp(self):
        self.user_seq = 0

    def api(self, user):
        client = APIClient()
        client.force_authenticate(user)
        return client

    def at(self, hour, minute=0):
        return timezone.make_aware(datetime.combine(self.day, time(hour, minute)))

    def matches(self, per_field: int, minutes=70, gap=20):
        """`per_field` partidos seguidos en cada cancha (con `gap` minutos entre uno y otro), a las mismas horas en ambas."""
        created = []
        for field in self.fields:
            for i in range(per_field):
                start = self.at(8) + timedelta(minutes=(minutes + gap) * i)
                created.append(Match.objects.create(
                    tournament=self.tournament, category=self.cat, home=self.home, away=self.away,
                    matchday=self.matchday, field=field, scheduled_start=start,
                    scheduled_end=start + timedelta(minutes=minutes), status=Match.Status.PENDING))
        return created

    def officials(self, model, count, with_users=False):
        out = []
        for i in range(count):
            self.user_seq += 1
            account = f.user(f"oficial{self.user_seq}") if with_users else None
            out.append(f.official(model, f"Nombre{i}", f"{model}{i}", account))
        return out

    def run_auto(self, user=None, **body):
        return self.api(user or self.authority).post(f"/api/matchdays/{self.matchday.id}/auto-assign-officials/",
                                                     body, format="json")

    def assert_humanly_possible(self):
        """Cada oficial: una sola cancha en el día, nunca dos partidos a la vez y 20' entre uno y otro."""
        rows = Match.objects.filter(matchday=self.matchday)
        for model, positions in ((Delegate, ["delegate"]), (Referee, REFEREE_FIELDS)):
            schedule = defaultdict(list)
            for m in rows:
                for p in positions:
                    official_id = getattr(m, f"{p}_id")
                    if official_id:
                        schedule[official_id].append(m)
            for official_id, items in schedule.items():
                self.assertEqual(len({m.field_id for m in items}), 1, f"{model.__name__} {official_id} en dos canchas")
                items.sort(key=lambda m: m.scheduled_start)
                for a, b in zip(items, items[1:]):
                    self.assertLessEqual(a.scheduled_end + timedelta(minutes=20), b.scheduled_start,
                                         f"{model.__name__} {official_id} sin preparación")

    def loads(self, positions):
        counts = Counter()
        for m in Match.objects.filter(matchday=self.matchday):
            for p in positions:
                if getattr(m, f"{p}_id"):
                    counts[getattr(m, f"{p}_id")] += 1
        return counts

    def test_fills_every_position_evenly(self):
        self.matches(4)
        self.officials("Delegate", 4)
        self.officials("Referee", 12)
        res = self.run_auto()
        self.assertEqual(res.status_code, 200, res.data)
        self.assertEqual(res.data["missing"], {"delegate": 0, "referees": 0})
        self.assertEqual(res.data["assigned"], 8 + 8 * 3)
        for m in Match.objects.filter(matchday=self.matchday):
            self.assertTrue(all(getattr(m, f"{p}_id") for p in POSITIONS))
        self.assert_humanly_possible()
        self.assertEqual(set(self.loads(["delegate"]).values()), {2})  # 8 partidos / 4 delegados
        self.assertEqual(set(self.loads(REFEREE_FIELDS).values()), {2})  # 24 posiciones / 12 árbitros

    def test_few_officials_share_the_extra_load_equally(self):
        self.matches(6)
        self.officials("Delegate", 2)
        self.officials("Referee", 6)
        res = self.run_auto()
        self.assertEqual(res.data["missing"], {"delegate": 0, "referees": 0})
        self.assert_humanly_possible()
        # Pasan del ideal de 4, pero todos por igual.
        self.assertEqual(set(self.loads(["delegate"]).values()), {6})
        self.assertEqual(set(self.loads(REFEREE_FIELDS).values()), {6})
        self.assertEqual(res.data["over_target"], {"delegate": 2, "referees": 6})

    def test_not_enough_officials_leaves_gaps_instead_of_doubling(self):
        self.matches(3)
        self.officials("Delegate", 1)  # dos canchas a la misma hora: una queda sin delegado
        res = self.run_auto(roles=["delegate"])
        self.assertEqual(res.data["missing"], {"delegate": 3})
        self.assert_humanly_possible()

    def test_respects_existing_assignments_and_their_field(self):
        matches = self.matches(4)
        a, b = self.officials("Delegate", 2)
        Match.objects.filter(pk=matches[0].pk).update(delegate=a)  # «a» ya está en la cancha A
        res = self.run_auto(roles=["delegate"])
        self.assertEqual(res.data["missing"], {"delegate": 0})
        self.assert_humanly_possible()
        fields_a = set(Match.objects.filter(matchday=self.matchday, delegate=a).values_list("field", flat=True))
        self.assertEqual(fields_a, {self.fields[0].id})

    def test_other_tournaments_same_day_bind_the_official(self):
        self.matches(2)
        busy = self.officials("Delegate", 1)[0]
        other_field = f.field("Cancha Externa")
        other = f.tournament("Otra Copa", categories=[self.cat], fields=[other_field])
        h = f.register(other, f.team("Pumas FC", self.cat, players=0), self.cat, with_roster=False)
        w = f.register(other, f.team("Toros FC", self.cat, players=0), self.cat, with_roster=False)
        Match.objects.create(tournament=other, category=self.cat, home=h, away=w, field=other_field, delegate=busy,
                             scheduled_start=self.at(18), scheduled_end=self.at(19), status=Match.Status.PENDING)
        res = self.run_auto(roles=["delegate"])
        self.assertEqual(res.data["missing"], {"delegate": 4})  # ya trabaja ese día en otra cancha
        self.assertFalse(Match.objects.filter(matchday=self.matchday, delegate=busy).exists())

    def test_officials_need_twenty_minutes_between_matches(self):
        self.matches(4, gap=0)  # partidos pegados: un mismo delegado no puede hacer dos seguidos
        self.officials("Delegate", 4)
        res = self.run_auto(roles=["delegate"])
        self.assertEqual(res.data["missing"], {"delegate": 0})
        self.assert_humanly_possible()
        self.assertEqual(set(self.loads(["delegate"]).values()), {2})  # alternan: 1.º y 3.º, 2.º y 4.º

    def test_notifies_each_official_once(self):
        self.matches(2)
        delegates = self.officials("Delegate", 2, with_users=True)
        self.run_auto(roles=["delegate"])
        for d in delegates:
            self.assertEqual(Notification.objects.filter(recipient=d.user).count(), 1)

    def test_heads_only_assign_their_own_officials(self):
        self.matches(1)
        self.officials("Delegate", 2)
        self.officials("Referee", 6)
        self.assertEqual(self.run_auto(self.head_referee, roles=["delegate"]).status_code, 403)
        res = self.run_auto(self.head_delegate)
        self.assertEqual(res.status_code, 200, res.data)
        self.assertEqual(list(res.data["missing"]), ["delegate"])
        self.assertFalse(Match.objects.filter(matchday=self.matchday).exclude(referee=None).exists())

    def test_only_submitted_matchdays(self):
        Matchday.objects.filter(pk=self.matchday.pk).update(status=Matchday.Status.DRAFT)
        self.assertEqual(self.run_auto().status_code, 400)
