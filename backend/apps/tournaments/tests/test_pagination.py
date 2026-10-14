"""Paginado de 20 en 20 y listados completos tras una inscripción masiva (50 equipos × 8 categorías)."""
from django.core.management import call_command
from django.test import TestCase
from rest_framework.test import APIClient

from apps.core import factories as f


class PaginationTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        call_command("seed_roles", verbosity=0)
        cls.admin = f.user("admin", superuser=True)
        cls.cats = [f.category(f"Sub-{age + 1}", max_age=age) for age in range(7, 15)]
        cls.tournament = f.tournament(categories=cls.cats)
        cls.teams = []
        for i in range(50):
            team = f.team(f"Equipo {i:02d}", cls.cats[0], players=0)
            team.categories.set(cls.cats)
            cls.teams.append(team)

    def setUp(self):
        self.api = APIClient()
        self.api.force_authenticate(self.admin)
        res = self.api.post("/api/registrations/bulk/", {"tournament": self.tournament.id, "teams": [
            {"team": t.id, "categories": [c.id for c in self.cats]} for t in self.teams]}, format="json")
        self.assertEqual(res.json()["created"], 400)

    def walk(self, **params):
        ids, page = [], 1
        while True:
            data = self.api.get("/api/registrations/", {"tournament": self.tournament.id, **params, "page": page}).json()
            ids += [r["id"] for r in data["results"]]
            if not data["next"]:
                return data["count"], ids
            page += 1

    def test_default_page_size_is_20(self):
        data = self.api.get("/api/registrations/", {"tournament": self.tournament.id}).json()
        self.assertEqual(data["count"], 400)
        self.assertEqual(len(data["results"]), 20)

    def test_every_registration_is_reachable_across_pages(self):
        for page_size in (20, 200):
            count, ids = self.walk(page_size=page_size)
            self.assertEqual((count, len(ids), len(set(ids))), (400, 400, 400))

    def test_stable_pages_with_non_unique_ordering(self):
        # Ordenar solo por categoría deja 50 empates por valor: el desempate por pk evita repetidos u omitidos.
        count, ids = self.walk(page_size=7, ordering="category")
        self.assertEqual((len(ids), len(set(ids))), (count, count))
