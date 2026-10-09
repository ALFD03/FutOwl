"""Validadores reutilizables: documentos de identidad, teléfonos y archivos subidos."""
import os
import re

from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.validators import RegexValidator
from PIL import Image

vat_number_validator = RegexValidator(
    regex=r"^\d{5,9}$",
    message="El número de documento debe contener solo dígitos (5 a 9).",
)

phone_validator = RegexValidator(
    regex=r"^\+?\d[\d\s-]{6,18}$",
    message="Teléfono inválido. Ejemplo: +58 412-1234567",
)

IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}
DOCUMENT_EXTENSIONS = {".pdf", ".docx", ".doc"}

# Firmas binarias ("magic bytes") permitidas. Rechazar archivos cuyo contenido
# no coincide con la extensión ayuda a bloquear ejecutables disfrazados.
MAGIC_SIGNATURES = {
    ".pdf": [b"%PDF"],
    ".docx": [b"PK\x03\x04"],
    ".doc": [b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1"],
    ".jpg": [b"\xff\xd8\xff"],
    ".jpeg": [b"\xff\xd8\xff"],
    ".png": [b"\x89PNG\r\n\x1a\n"],
    ".webp": [b"RIFF"],
    ".csv": [],
}

DANGEROUS_PATTERNS = [b"<script", b"MZ\x90\x00", b"\x7fELF", b"#!/"]


def _read_head(file, size=2048) -> bytes:
    pos = file.tell() if hasattr(file, "tell") else 0
    file.seek(0)
    head = file.read(size)
    file.seek(pos)
    return head


def _check_size(file, max_mb: int):
    if file.size > max_mb * 1024 * 1024:
        raise ValidationError(f"El archivo supera el tamaño máximo de {max_mb} MB.")


def _check_signature(file, ext: str):
    head = _read_head(file)
    signatures = MAGIC_SIGNATURES.get(ext, [])
    if signatures and not any(head.startswith(sig) for sig in signatures):
        raise ValidationError("El contenido del archivo no coincide con su tipo.")
    lowered = head.lower()
    if any(pattern.lower() in lowered for pattern in DANGEROUS_PATTERNS):
        raise ValidationError("El archivo contiene contenido potencialmente peligroso.")


def validate_image_upload(file):
    ext = os.path.splitext(file.name)[1].lower()
    if ext not in IMAGE_EXTENSIONS:
        raise ValidationError(f"Formato de imagen no permitido. Use: {', '.join(sorted(IMAGE_EXTENSIONS))}")
    _check_size(file, settings.MAX_IMAGE_UPLOAD_MB)
    _check_signature(file, ext)
    try:
        pos = file.tell()
        file.seek(0)
        Image.open(file).verify()
        file.seek(pos)
    except Exception as exc:  # noqa: BLE001
        raise ValidationError("La imagen está dañada o no es válida.") from exc


def validate_document_upload(file):
    ext = os.path.splitext(file.name)[1].lower()
    allowed = DOCUMENT_EXTENSIONS | IMAGE_EXTENSIONS
    if ext not in allowed:
        raise ValidationError(f"Formato no permitido. Use: {', '.join(sorted(allowed))}")
    if ext in IMAGE_EXTENSIONS:
        return validate_image_upload(file)
    _check_size(file, settings.MAX_DOCUMENT_UPLOAD_MB)
    _check_signature(file, ext)
