from django.core.exceptions import ImproperlyConfigured

from .base import *  # noqa: F401,F403
from .base import FIELD_ENCRYPTION_KEY, SECRET_KEY, env_bool

DEBUG = False

if SECRET_KEY.startswith("dev-") or len(SECRET_KEY) < 40:
    raise ImproperlyConfigured("DJANGO_SECRET_KEY debe ser una clave segura en producción.")
if not FIELD_ENCRYPTION_KEY:
    raise ImproperlyConfigured("FIELD_ENCRYPTION_KEY es obligatoria en producción.")

# HTTPS estricto
SECURE_SSL_REDIRECT = env_bool("SECURE_SSL_REDIRECT", True)
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
SECURE_HSTS_SECONDS = 63072000
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
AUTH_REFRESH_COOKIE_SECURE = True
