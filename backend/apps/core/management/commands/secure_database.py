from django.core.management.base import BaseCommand
from django.db import connection

from apps.core.db import enable_row_level_security, install_append_only_triggers


class Command(BaseCommand):
    help = "Reaplica las protecciones de base de datos (RLS y triggers de solo inserción) en PostgreSQL."

    def handle(self, *args, **options):
        if connection.vendor != "postgresql":
            self.stdout.write(self.style.WARNING("Solo aplica a PostgreSQL. Nada que hacer."))
            return
        with connection.schema_editor() as editor:
            install_append_only_triggers(None, editor)
            enable_row_level_security(None, editor)
        self.stdout.write(self.style.SUCCESS("Protecciones aplicadas."))
