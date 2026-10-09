from .base import *  # noqa: F401,F403
from .base import env_bool

DEBUG = env_bool("DJANGO_DEBUG", True)
AUTH_REFRESH_COOKIE_SECURE = False
AUTH_REFRESH_COOKIE_SAMESITE = "Lax"
