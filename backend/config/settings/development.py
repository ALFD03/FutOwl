from .base import *  # noqa: F401,F403
from .base import env, env_bool

DEBUG = env_bool("DJANGO_DEBUG", True)
AUTH_REFRESH_COOKIE_SECURE = False
AUTH_REFRESH_COOKIE_SAMESITE = "Lax"

# `make dev` exporta FRONTEND_PORT cuando el frontend no usa el 5173 (p. ej. porque estaba ocupado):
# el proxy de Vite conserva el Origin del navegador, así que ese origen debe ser de confianza.
_frontend_port = env("FRONTEND_PORT")
if _frontend_port:
    for _origin in (f"http://localhost:{_frontend_port}", f"http://127.0.0.1:{_frontend_port}"):
        if _origin not in CORS_ALLOWED_ORIGINS:  # noqa: F405
            CORS_ALLOWED_ORIGINS.append(_origin)  # noqa: F405
        if _origin not in CSRF_TRUSTED_ORIGINS:  # noqa: F405
            CSRF_TRUSTED_ORIGINS.append(_origin)  # noqa: F405
