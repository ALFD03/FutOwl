"""Rutas de subida con nombres aleatorios (evita colisiones y path traversal)."""
import os
import uuid

from django.utils import timezone


class UploadTo:
    """Callable serializable para `upload_to` que renombra el archivo con un UUID."""

    def __init__(self, folder: str):
        self.folder = folder

    def __call__(self, instance, filename):
        ext = os.path.splitext(filename)[1].lower()[:10]
        return f"{self.folder}/{timezone.now():%Y/%m}/{uuid.uuid4().hex}{ext}"

    def deconstruct(self):
        return ("apps.core.uploads.UploadTo", [self.folder], {})
