import io

from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.management import call_command
from django.test import TestCase
from docx import Document
from rest_framework.test import APIClient

from apps.competition.services.lineups import parse_lineup_file
from apps.core import factories as f


class DocumentTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        call_command("seed_roles", verbosity=0)
        cls.admin = f.user("admin", superuser=True)
        cls.cat = f.category()
        cls.team = f.team("Águilas & Co", cls.cat, players=5)
        cls.tournament = f.tournament(categories=[cls.cat], regulation_text="# Capítulo 1\n- Regla uno")
        f.register(cls.tournament, cls.team, cls.cat)  # la planilla sale de la nómina del torneo

    def setUp(self):
        self.api = APIClient()
        self.api.force_authenticate(self.admin)

    def test_exports_pdf_and_docx(self):
        base = f"/api/tournaments/{self.tournament.id}/documents"
        params = {"team": self.team.id, "category": self.cat.id}
        pdf = self.api.get(f"{base}/lineup-sheet/", {**params, "format_type": "pdf"})
        self.assertEqual(pdf.status_code, 200)
        self.assertTrue(pdf.content.startswith(b"%PDF"))
        for path in ("substitution-cards", "regulation"):
            res = self.api.get(f"{base}/{path}/", {**params, "format_type": "docx"})
            self.assertEqual(res.status_code, 200)
            self.assertTrue(res.content.startswith(b"PK"))

    def test_lineup_sheet_roundtrip_import(self):
        res = self.api.get(f"/api/tournaments/{self.tournament.id}/documents/lineup-sheet/",
                           {"team": self.team.id, "category": self.cat.id, "format_type": "docx"})
        document = Document(io.BytesIO(res.content))
        table = next(t for t in document.tables if t.rows[0].cells[0].text == "ID")
        # El equipo marca convocados y titulares en la planilla
        for i, row in enumerate(table.rows[1:4]):
            row.cells[5].text = "X"
            if i < 2:
                row.cells[6].text = "X"
        table.rows[1].cells[7].text = "x"
        buffer = io.BytesIO()
        document.save(buffer)
        players = parse_lineup_file(SimpleUploadedFile("planilla.docx", buffer.getvalue()))
        self.assertEqual(len(players), 3)
        self.assertEqual(sum(p["is_starter"] for p in players), 2)
        self.assertTrue(players[0]["is_captain"])
