"""
Contenido base de la documentación: archivos Markdown en `content/` con un encabezado
de metadatos (front matter) como este:

    ---
    title: Primeros pasos
    summary: Ingresar, aceptar los términos y conocer la interfaz
    section: manual
    order: 20
    ---

El nombre del archivo (sin `.md`) es el identificador de la página. Este módulo no importa
modelos para poder usarse también desde las migraciones.
"""
from pathlib import Path

CONTENT_DIR = Path(__file__).resolve().parent / "content"
META_KEYS = {"title", "summary", "section", "order"}


def parse(path: Path) -> dict:
    text = path.read_text(encoding="utf-8")
    meta: dict = {}
    if text.startswith("---\n"):
        header, _, text = text[4:].partition("\n---\n")
        for line in header.splitlines():
            key, _, value = line.partition(":")
            if key.strip() in META_KEYS:
                meta[key.strip()] = value.strip().strip('"')
    if "title" not in meta:
        raise ValueError(f"{path.name}: falta 'title' en el encabezado.")
    return {
        "slug": path.stem,
        "title": meta["title"],
        "summary": meta.get("summary", ""),
        "section": meta.get("section", "manual"),
        "order": int(meta.get("order", 0)),
        "content": text.lstrip("\n"),
    }


def read_pages() -> list[dict]:
    return [parse(path) for path in sorted(CONTENT_DIR.glob("*.md"))]


def load_pages(page_model, revision_model, *, overwrite: bool = False, user=None) -> dict:
    """Crea las páginas que falten; con `overwrite` también reemplaza el contenido de las existentes."""
    created = updated = 0
    for data in read_pages():
        page = page_model.objects.filter(slug=data["slug"]).first()
        if page is None:
            page = page_model.objects.create(**data, updated_by=user)
            created += 1
        elif overwrite and (page.content != data["content"] or page.title != data["title"]):
            for key, value in data.items():
                setattr(page, key, value)
            page.updated_by = user
            page.save()
            updated += 1
        else:
            continue
        revision_model.objects.create(page=page, title=page.title, content=page.content, edited_by=user)
    return {"created": created, "updated": updated}
