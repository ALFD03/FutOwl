from fnmatch import fnmatch

from django.contrib.auth.models import Group, Permission
from django.core.management.base import BaseCommand

from apps.accounts.roles import RETIRED_ROLES, ROLE_PERMISSIONS


class Command(BaseCommand):
    help = "Crea/actualiza los roles predefinidos de FutOwl con sus permisos."

    def handle(self, *args, **options):
        all_perms = list(Permission.objects.select_related("content_type"))
        for role, patterns in ROLE_PERMISSIONS.items():
            group, _ = Group.objects.get_or_create(name=role)
            selected = [
                p for p in all_perms
                if any(fnmatch(f"{p.content_type.app_label}.{p.codename}", pattern) for pattern in patterns)
            ]
            group.permissions.set(selected)
            if options["verbosity"]:
                self.stdout.write(self.style.SUCCESS(f"Rol '{role}': {len(selected)} permisos"))
        # Los roles retirados se eliminan solo si nadie los usa; si tienen usuarios se conservan.
        for name in RETIRED_ROLES:
            group = Group.objects.filter(name=name).first()
            if group and not group.user_set.exists():
                group.delete()
                if options["verbosity"]:
                    self.stdout.write(f"Rol retirado eliminado: '{name}'")
