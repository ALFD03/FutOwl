from django.db import migrations

from apps.core.db import enable_row_level_security, install_append_only_triggers
from apps.docs.loader import load_pages


def create_pages(apps, schema_editor):
    load_pages(apps.get_model("docs", "DocPage"), apps.get_model("docs", "DocRevision"))


class Migration(migrations.Migration):
    dependencies = [
        ("docs", "0001_initial"),
        ("competition", "0002_database_protections"),
    ]

    operations = [
        # Revisiones de solo inserción y RLS en las tablas nuevas (solo PostgreSQL / Supabase).
        migrations.RunPython(install_append_only_triggers, migrations.RunPython.noop),
        migrations.RunPython(enable_row_level_security, migrations.RunPython.noop),
        migrations.RunPython(create_pages, migrations.RunPython.noop),
    ]
