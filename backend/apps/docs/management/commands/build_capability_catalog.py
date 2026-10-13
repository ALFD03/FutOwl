"""Regenera docs/content/catalogo-de-permisos.md a partir de accounts/capabilities.py y los roles."""
from pathlib import Path

from django.core.management.base import BaseCommand

from apps.accounts.capabilities import AREAS, CAPABILITIES
from apps.accounts.roles import ROLE_CAPABILITIES

TARGET = Path(__file__).resolve().parents[2] / "content" / "catalogo-de-permisos.md"

HEADER = """---
title: Catálogo de capacidades
summary: Qué permite cada capacidad, con qué roles viene y qué permisos técnicos activa
section: permissions
order: 30
---
Las **capacidades** son lo que se asigna a roles y usuarios: cada una es una función concreta del sistema. Esta página explica todas; al final está el **catálogo interactivo**, con buscador, filtro por rol y la columna *Usted* que indica si su cuenta la tiene.

> [!NOTE]
> «Editar» incluye **desactivar y reactivar**. Lo que está en **borrador** (torneos, jornadas y partidos) se puede eliminar definitivamente; una vez enviado o confirmado ya no se borra.
"""

FOOTER = """
## Documentación

Editar esta documentación **no** depende de ninguna capacidad: es exclusivo del **superusuario**. Leerla está permitido a cualquier usuario con sesión.

## Catálogo interactivo

```futowl-permisos
```
"""


class Command(BaseCommand):
    help = "Regenera el catálogo de capacidades de la documentación (luego: make docs)."

    def handle(self, *args, **options):
        out = [HEADER]
        for area in AREAS:
            out.append(f"\n## {area}\n\n| Capacidad | Qué permite | Roles que la traen |\n|-----------|-------------|--------------------|")
            for c in (c for c in CAPABILITIES if c.area == area):
                holders = ", ".join(role for role, codes in ROLE_CAPABILITIES.items() if c.code in codes)
                out.append(f"| **{c.label}** | {c.description} | {holders} |")
        out.append(
            "\n## Permisos técnicos\n\nPor dentro, cada capacidad activa uno o varios permisos técnicos de Django "
            "(por ejemplo, *Gestionar canchas* activa `registry.add_field` y `registry.change_field`). Los permisos "
            "técnicos que no forman parte de ninguna capacidad **no habilitan nada por sí solos** y no se asignan.\n\n"
            "| Capacidad | Permisos técnicos que activa |\n|-----------|------------------------------|"
        )
        out += [f"| {c.label} | {', '.join(f'`{g}`' for g in c.grants)} |" for c in CAPABILITIES]
        out.append(FOOTER)
        TARGET.write_text("\n".join(out), encoding="utf-8")
        self.stdout.write(self.style.SUCCESS(f"Catálogo regenerado: {TARGET.name}"))
