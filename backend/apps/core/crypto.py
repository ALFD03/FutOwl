"""
Utilidades de cifrado simétrico (Fernet / AES-128-CBC + HMAC-SHA256)
e índices ciegos (HMAC-SHA256) para datos sensibles.
"""
import base64
import hashlib
import hmac
from functools import lru_cache

from cryptography.fernet import Fernet, InvalidToken
from django.conf import settings

PREFIX = "enc::"


@lru_cache(maxsize=1)
def _fernet() -> Fernet:
    key = settings.FIELD_ENCRYPTION_KEY
    if not key:
        # Solo para desarrollo: deriva una clave a partir de SECRET_KEY.
        digest = hashlib.sha256(settings.SECRET_KEY.encode()).digest()
        key = base64.urlsafe_b64encode(digest).decode()
    return Fernet(key.encode() if isinstance(key, str) else key)


def encrypt(value: str | None) -> str | None:
    if value in (None, ""):
        return value
    if value.startswith(PREFIX):
        return value
    return PREFIX + _fernet().encrypt(value.encode()).decode()


def decrypt(value: str | None) -> str | None:
    if value in (None, "") or not value.startswith(PREFIX):
        return value
    try:
        return _fernet().decrypt(value[len(PREFIX):].encode()).decode()
    except InvalidToken:
        return None


def blind_index(value: str | None) -> str:
    """Hash determinista (no reversible) para búsquedas y unicidad."""
    if not value:
        return ""
    normalized = value.strip().upper()
    return hmac.new(settings.BLIND_INDEX_KEY.encode(), normalized.encode(), hashlib.sha256).hexdigest()
