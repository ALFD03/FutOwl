from pathlib import Path

from django.db import migrations

TERMS_FILE = Path(__file__).resolve().parent.parent / "terms_v1.md"


def create_terms(apps, schema_editor):
    TermsVersion = apps.get_model("legal", "TermsVersion")
    if not TermsVersion.objects.filter(version="1.0").exists():
        TermsVersion.objects.create(version="1.0", content=TERMS_FILE.read_text(encoding="utf-8"))


class Migration(migrations.Migration):
    dependencies = [("legal", "0001_initial")]

    operations = [migrations.RunPython(create_terms, migrations.RunPython.noop)]
