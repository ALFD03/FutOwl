from django.core.management.base import BaseCommand

from apps.docs.loader import load_pages
from apps.docs.models import DocPage, DocRevision


class Command(BaseCommand):
    help = "Carga la documentación base (apps/docs/content/*.md). Por defecto solo crea las páginas que falten."

    def add_arguments(self, parser):
        parser.add_argument("--overwrite", action="store_true",
                            help="Reemplaza también el contenido de las páginas existentes (queda una revisión).")

    def handle(self, *args, **options):
        result = load_pages(DocPage, DocRevision, overwrite=options["overwrite"])
        if options["verbosity"]:
            self.stdout.write(self.style.SUCCESS(
                f"Documentación: {result['created']} página(s) creada(s), {result['updated']} actualizada(s)."
            ))
