import re

from django.contrib.auth.models import Permission
from django.core.management import call_command
from django.test import TestCase
from rest_framework.test import APIClient

from apps.accounts import roles
from apps.accounts.views import PermissionViewSet
from apps.core import factories as f
from apps.core.models import ImmutableRecordError

from .loader import read_pages
from .models import DocPage, DocRevision

# Tablas cuyos permisos no habilitan acciones por sí solos: el catálogo los explica en bloque.
INTERNAL_MODELS = {
    "lineup", "lineupplayer", "matchevent", "matchconfirmation", "matchadjustment", "matchreport", "reportreturn",
    "matchclosure", "termsacceptance", "notification",
}
WIDGETS = {"futowl-roles", "futowl-permisos", "futowl-mis-permisos"}


class DocContentTests(TestCase):
    """Coherencia del contenido base (apps/docs/content/*.md)."""

    @classmethod
    def setUpTestData(cls):
        cls.pages = read_pages()
        cls.slugs = {p["slug"] for p in cls.pages}

    def test_pages_are_valid_and_loaded_by_the_migration(self):
        sections = set(DocPage.Section.values)
        for page in self.pages:
            self.assertIn(page["section"], sections, page["slug"])
            self.assertTrue(page["content"].strip(), page["slug"])
        self.assertEqual(set(DocPage.objects.values_list("slug", flat=True)), self.slugs)
        self.assertEqual(DocRevision.objects.count(), len(self.pages))

    def test_internal_links_point_to_existing_pages(self):
        for page in self.pages:
            for target in re.findall(r"\]\(/app/ayuda/([a-z0-9-]+)", page["content"]):
                self.assertIn(target, self.slugs, f"{page['slug']} enlaza a /app/ayuda/{target}")

    def test_only_known_widgets_are_used(self):
        for page in self.pages:
            for lang in re.findall(r"^```(futowl-[a-z-]+)", page["content"], re.MULTILINE):
                self.assertIn(lang, WIDGETS, page["slug"])

    def test_permission_catalog_documents_every_actionable_permission(self):
        content = next(p["content"] for p in self.pages if p["slug"] == "catalogo-de-permisos")
        missing = [
            f"{p.content_type.app_label}.{p.codename}"
            for p in PermissionViewSet.queryset.all()
            if p.content_type.model not in INTERNAL_MODELS and f"`{p.content_type.app_label}.{p.codename}`" not in content
            and not p.codename.startswith(("view_terms", "change_terms", "delete_terms"))
        ]
        self.assertEqual(missing, [], "Documente estos permisos en catalogo-de-permisos.md")

    def test_predefined_roles_are_documented(self):
        content = next(p["content"] for p in self.pages if p["slug"] == "roles-predefinidos")
        for role in roles.ROLE_PERMISSIONS:
            self.assertIn(f"### {role}", content)


class DocApiTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        call_command("seed_roles", verbosity=0)
        cls.admin = f.user("root", superuser=True)
        cls.authority = f.user("autoridad", role=roles.AUTHORITY)
        cls.referee = f.user("arbitro", role=roles.REFEREE)

    def client_for(self, user):
        client = APIClient()
        client.force_authenticate(user)
        return client

    def test_any_user_reads_published_pages_only(self):
        DocPage.objects.filter(slug="api").update(is_active=False)
        client = self.client_for(self.referee)
        slugs = {p["slug"] for p in client.get("/api/docs/").json()}
        self.assertIn("mesa-tecnica", slugs)
        self.assertNotIn("api", slugs)
        self.assertEqual(client.get("/api/docs/api/").status_code, 404)
        page = client.get("/api/docs/mesa-tecnica/").json()
        self.assertIn("Protocolo previo", page["content"])
        self.assertIn("api", {p["slug"] for p in self.client_for(self.admin).get("/api/docs/").json()})

    def test_search_includes_content(self):
        results = self.client_for(self.referee).get("/api/docs/", {"search": "doble amarilla"}).json()
        self.assertIn("mesa-tecnica", {p["slug"] for p in results})

    def test_only_superuser_edits_and_each_save_keeps_a_revision(self):
        payload = {"content": "## Nuevo\n\nTexto"}
        for user in (self.authority, self.referee):
            self.assertEqual(self.client_for(user).patch("/api/docs/mesa-tecnica/", payload, format="json").status_code, 403)
            self.assertEqual(self.client_for(user).post("/api/docs/", {"slug": "x", "title": "X"}, format="json").status_code, 403)

        client = self.client_for(self.admin)
        before = DocRevision.objects.filter(page__slug="mesa-tecnica").count()
        res = client.patch("/api/docs/mesa-tecnica/", payload, format="json")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["updated_by_name"], "root")
        self.assertEqual(DocRevision.objects.filter(page__slug="mesa-tecnica").count(), before + 1)
        # Despublicar no cambia el contenido: no genera revisión.
        client.patch("/api/docs/mesa-tecnica/", {"is_active": False}, format="json")
        self.assertEqual(DocRevision.objects.filter(page__slug="mesa-tecnica").count(), before + 1)

        revisions = client.get("/api/docs/mesa-tecnica/revisions/").json()
        self.assertEqual(revisions[0]["content"], payload["content"])
        self.assertEqual(self.client_for(self.referee).get("/api/docs/mesa-tecnica/revisions/").status_code, 403)

    def test_create_page_validates_slug(self):
        client = self.client_for(self.admin)
        bad = client.post("/api/docs/", {"slug": "Mala URL", "title": "X"}, format="json")
        self.assertEqual(bad.status_code, 400)
        reserved = client.post("/api/docs/", {"slug": "permission-catalog", "title": "X"}, format="json")
        self.assertEqual(reserved.status_code, 400)
        ok = client.post("/api/docs/", {"slug": "guia-rapida", "title": "Guía rápida", "section": "faq",
                                        "content": "Hola"}, format="json")
        self.assertEqual(ok.status_code, 201)
        self.assertEqual(DocRevision.objects.filter(page__slug="guia-rapida").count(), 1)
        with self.assertRaises(ImmutableRecordError):
            DocPage.objects.get(slug="guia-rapida").delete()

    def test_permission_catalog_is_readable_by_any_user(self):
        data = self.client_for(self.referee).get("/api/docs/permission-catalog/").json()
        codes = {p["code"] for p in data["permissions"]}
        self.assertIn("competition.close_match", codes)
        self.assertFalse(Permission.objects.filter(content_type__app_label="docs").exists())
        referee_role = next(r for r in data["roles"] if r["name"] == roles.REFEREE)
        self.assertIn("competition.submit_referee_report", referee_role["permissions"])
        self.assertEqual(referee_role["user_count"], 1)

    def test_terms_must_be_accepted_to_read(self):
        user = f.user("sin-terminos", accept_terms=False)
        self.assertEqual(self.client_for(user).get("/api/docs/").status_code, 403)

    def test_load_docs_overwrite_restores_base_content(self):
        DocPage.objects.filter(slug="alineaciones").update(content="editado")
        call_command("load_docs", verbosity=0)
        self.assertEqual(DocPage.objects.get(slug="alineaciones").content, "editado")
        call_command("load_docs", "--overwrite", verbosity=0)
        self.assertIn("Importar la planilla", DocPage.objects.get(slug="alineaciones").content)
