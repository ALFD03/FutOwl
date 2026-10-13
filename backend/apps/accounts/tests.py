"""Capacidades: catálogo coherente, roles predefinidos y asignación de oficiales por los jefes."""
from datetime import date

from django.contrib.auth.models import Group, Permission
from django.core.management import call_command
from django.test import TestCase
from rest_framework.test import APIClient

from apps.accounts import roles
from apps.accounts.capabilities import ALL_GRANTS, BY_CODE, CAPABILITIES
from apps.competition.models import Match, Matchday
from apps.core import factories as f


class CapabilityCatalogTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        call_command("seed_roles", verbosity=0)

    def test_every_grant_is_a_real_permission(self):
        existing = {f"{p.content_type.app_label}.{p.codename}" for p in Permission.objects.select_related("content_type")}
        self.assertEqual(sorted(set(ALL_GRANTS) - existing), [])

    def test_roles_use_known_capabilities(self):
        for role, codes in roles.ROLE_CAPABILITIES.items():
            self.assertEqual([c for c in codes if c not in BY_CODE], [], role)

    def test_heads_assign_officials_but_do_not_schedule(self):
        head = {f"{p.content_type.app_label}.{p.codename}" for p in Group.objects.get(name=roles.HEAD_REFEREE).permissions
                .select_related("content_type")}
        self.assertIn("competition.assign_referees", head)
        self.assertIn("competition.submit_referee_report", head)  # también ejerce como árbitro
        self.assertNotIn("competition.change_match", head)
        self.assertNotIn("competition.assign_delegate", head)

    def test_capabilities_endpoint(self):
        api = APIClient()
        api.force_authenticate(f.user("cualquiera"))
        data = api.get("/api/capabilities/").data
        self.assertEqual([c["code"] for c in data["capabilities"]], [c.code for c in CAPABILITIES])
        self.assertTrue(all(c["permissions"] for c in data["capabilities"]))


class OfficialAssignmentTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        call_command("seed_roles", verbosity=0)
        cls.head_referee = f.user("jefe_arbitros", role=roles.HEAD_REFEREE)
        cls.head_delegate = f.user("jefe_delegados", role=roles.HEAD_DELEGATE)
        cat = f.category()
        cls.field = f.field()
        tournament = f.tournament(categories=[cat], fields=[cls.field])
        home = f.register(tournament, f.team("Halcones FC", cat, players=0), cat, with_roster=False)
        away = f.register(tournament, f.team("Lobos FC", cat, players=0), cat, with_roster=False)
        matchday = Matchday.objects.create(tournament=tournament, number=1, date=date.today())
        cls.match = Match.objects.create(tournament=tournament, category=cat, home=home, away=away, matchday=matchday)
        cls.referee = f.official("Referee", "Luis", "Árbitro")
        cls.delegate = f.official("Delegate", "Ana", "Delegada")

    def patch(self, user, data):
        api = APIClient()
        api.force_authenticate(user)
        return api.patch(f"/api/matches/{self.match.id}/", data, format="json")

    def test_head_referee_assigns_referees_only(self):
        self.assertEqual(self.patch(self.head_referee, {"referee": self.referee.id}).status_code, 200)
        self.assertEqual(self.patch(self.head_referee, {"field": self.field.id}).status_code, 403)
        self.assertEqual(self.patch(self.head_referee, {"delegate": self.delegate.id}).status_code, 403)

    def test_head_delegate_assigns_delegate_only(self):
        self.assertEqual(self.patch(self.head_delegate, {"delegate": self.delegate.id}).status_code, 200)
        self.assertEqual(self.patch(self.head_delegate, {"referee": self.referee.id}).status_code, 403)

    def test_unchanged_fields_sent_along_are_ignored(self):
        res = self.patch(self.head_referee, {"referee": self.referee.id, "field": None, "delegate": None})
        self.assertEqual(res.status_code, 200, res.data)

    def test_head_cannot_adjust_schedule(self):
        api = APIClient()
        api.force_authenticate(self.head_referee)
        res = api.post(f"/api/matches/{self.match.id}/adjust/", {"field": self.field.id, "reason": "Cambio de cancha"},
                       format="json")
        self.assertEqual(res.status_code, 403)
