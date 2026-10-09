from datetime import date

from django.core.management import call_command
from django.db import connection
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from apps.audit.models import AuditLog
from apps.audit.services import verify_chain
from apps.competition.models import MatchEvent
from apps.core import factories as f
from apps.core.models import ImmutableRecordError
from apps.legal.models import TermsVersion


class SecurityTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        call_command("seed_roles", verbosity=0)

    def test_sensitive_data_is_encrypted_at_rest(self):
        player = f.player("Luis", "Mora", date(2000, 1, 1))
        with connection.cursor() as cursor:
            cursor.execute("SELECT vat_number, phone FROM registry_player WHERE id = %s", [player.id])
            vat, phone = cursor.fetchone()
        self.assertTrue(vat.startswith("enc::"))
        self.assertTrue(phone.startswith("enc::"))
        player.refresh_from_db()
        self.assertTrue(player.vat_number.isdigit())

    def test_minor_requires_guardian(self):
        from apps.registry.models import Player
        from django.core.exceptions import ValidationError

        p = Player(first_name="Niño", last_name="Prueba", birth_date=date(2016, 5, 5), vat_number="12345678")
        with self.assertRaises(ValidationError):
            p.clean()

    def test_audit_chain_is_valid_and_immutable(self):
        f.category()
        self.assertTrue(AuditLog.objects.exists())
        self.assertTrue(verify_chain()["valid"])
        entry = AuditLog.objects.first()
        entry.action = "tampered"
        with self.assertRaises(ImmutableRecordError):
            entry.save()
        with self.assertRaises(ImmutableRecordError):
            AuditLog.objects.all().delete()

    def test_master_records_are_never_deleted(self):
        cat = f.category()
        with self.assertRaises(ImmutableRecordError):
            cat.delete()

    def test_immutable_events(self):
        with self.assertRaises(ImmutableRecordError):
            MatchEvent.objects.all().update(notes="x")

    @override_settings(LOGIN_MAX_FAILED_ATTEMPTS=3)
    def test_login_lockout_and_cookie_refresh(self):
        f.user("pepe", password="Correcta#2026x")
        client = APIClient()
        for _ in range(3):
            self.assertEqual(client.post("/api/auth/login/", {"username": "pepe", "password": "mala"}).status_code,
                             401)
        res = client.post("/api/auth/login/", {"username": "pepe", "password": "Correcta#2026x"})
        self.assertEqual(res.status_code, 423)

        f.user("ana", password="Correcta#2026x")
        res = client.post("/api/auth/login/", {"username": "ana", "password": "Correcta#2026x"})
        self.assertEqual(res.status_code, 200)
        self.assertIn("access", res.data)
        self.assertIn("futowl_refresh", res.cookies)
        self.assertTrue(res.cookies["futowl_refresh"]["httponly"])
        res = client.post("/api/auth/refresh/")
        self.assertEqual(res.status_code, 200)
        self.assertIn("access", res.data)

    def test_terms_must_be_accepted(self):
        user = f.user("nuevo", accept_terms=False)
        client = APIClient()
        client.force_authenticate(user)
        self.assertEqual(client.get("/api/notifications/").status_code, 403)
        self.assertEqual(client.post("/api/legal/terms/accept/").status_code, 200)
        self.assertEqual(client.get("/api/notifications/").status_code, 200)
        self.assertTrue(TermsVersion.objects.exists())

    def test_server_time_is_venezuela(self):
        data = APIClient().get("/api/time/").data
        self.assertEqual(data["timezone"], "America/Caracas")
        self.assertEqual(data["utc_offset"], "-0400")

    def test_rejects_disguised_upload(self):
        from django.core.exceptions import ValidationError
        from django.core.files.uploadedfile import SimpleUploadedFile

        from apps.core.validators import validate_document_upload

        fake = SimpleUploadedFile("planilla.pdf", b"MZ\x90\x00 malicious", content_type="application/pdf")
        with self.assertRaises(ValidationError):
            validate_document_upload(fake)
