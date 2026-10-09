"""
Configuración base de FutOwl.

Todos los valores sensibles se leen desde variables de entorno (ver `.env.example`).
Los módulos `development` y `production` extienden esta configuración.
"""
from datetime import timedelta
from pathlib import Path
import os

import dj_database_url
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent.parent
load_dotenv(BASE_DIR / ".env")


def env(name: str, default: str | None = None) -> str | None:
    return os.environ.get(name, default)


def env_bool(name: str, default: bool = False) -> bool:
    return env(name, str(default)).lower() in {"1", "true", "yes", "on"}


def env_list(name: str, default: str = "") -> list[str]:
    return [item.strip() for item in env(name, default).split(",") if item.strip()]


SECRET_KEY = env("DJANGO_SECRET_KEY", "dev-insecure-change-me")
DEBUG = env_bool("DJANGO_DEBUG", False)
ALLOWED_HOSTS = env_list("DJANGO_ALLOWED_HOSTS", "localhost,127.0.0.1")

# Vercel inyecta los dominios de cada despliegue (producción, rama y URL única);
# se aceptan automáticamente para que los previews funcionen sin configuración extra.
VERCEL_HOSTS = [
    host for host in (env("VERCEL_PROJECT_PRODUCTION_URL"), env("VERCEL_BRANCH_URL"), env("VERCEL_URL")) if host
]
ALLOWED_HOSTS += VERCEL_HOSTS

# ---------------------------------------------------------------------------
# Aplicaciones
# ---------------------------------------------------------------------------
DJANGO_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
]
THIRD_PARTY_APPS = [
    "rest_framework",
    "rest_framework_simplejwt.token_blacklist",
    "corsheaders",
    "django_filters",
]
LOCAL_APPS = [
    "apps.core",
    "apps.audit",
    "apps.accounts",
    "apps.legal",
    "apps.notifications",
    "apps.registry",
    "apps.tournaments",
    "apps.competition",
]
INSTALLED_APPS = DJANGO_APPS + THIRD_PARTY_APPS + LOCAL_APPS

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    "apps.core.middleware.SecurityHeadersMiddleware",
    "apps.audit.middleware.AuditContextMiddleware",
]

ROOT_URLCONF = "config.urls"
WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

# ---------------------------------------------------------------------------
# Base de datos (Supabase Postgres en producción, SQLite en local)
# ---------------------------------------------------------------------------
DATABASES = {
    "default": dj_database_url.config(
        env="DATABASE_URL",
        default=f"sqlite:///{BASE_DIR / 'db.sqlite3'}",
        conn_max_age=int(env("DB_CONN_MAX_AGE", "0")),
        ssl_require=env_bool("DB_SSL_REQUIRE", False),
    )
}
# El pooler de Supabase en modo transacción (puerto 6543) no admite cursores del lado del servidor.
# El esquema (public / qa) lo fija el search_path del rol de base de datos de cada entorno.
DATABASES["default"]["DISABLE_SERVER_SIDE_CURSORS"] = True
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
AUTH_USER_MODEL = "accounts.User"

# ---------------------------------------------------------------------------
# Contraseñas
# ---------------------------------------------------------------------------
PASSWORD_HASHERS = [
    "django.contrib.auth.hashers.ScryptPasswordHasher",
    "django.contrib.auth.hashers.PBKDF2PasswordHasher",
]
AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator", "OPTIONS": {"min_length": 10}},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

# ---------------------------------------------------------------------------
# Internacionalización y zona horaria (Venezuela, UTC-4)
# ---------------------------------------------------------------------------
LANGUAGE_CODE = "es-ve"
TIME_ZONE = "America/Caracas"
USE_I18N = True
USE_TZ = True

# ---------------------------------------------------------------------------
# Archivos estáticos y multimedia
# ---------------------------------------------------------------------------
STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"

STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    "staticfiles": {"BACKEND": "whitenoise.storage.CompressedStaticFilesStorage"},
}

# Supabase Storage (API compatible con S3). Se activa si hay credenciales.
if env("SUPABASE_S3_ENDPOINT"):
    STORAGES["default"] = {
        "BACKEND": "storages.backends.s3.S3Storage",
        "OPTIONS": {
            "endpoint_url": env("SUPABASE_S3_ENDPOINT"),
            "access_key": env("SUPABASE_S3_ACCESS_KEY"),
            "secret_key": env("SUPABASE_S3_SECRET_KEY"),
            "bucket_name": env("SUPABASE_S3_BUCKET", "futowl"),
            "region_name": env("SUPABASE_S3_REGION", "us-east-1"),
            "default_acl": None,
            "querystring_auth": True,
            "querystring_expire": 3600,
            "file_overwrite": False,
        },
    }

FILE_UPLOAD_MAX_MEMORY_SIZE = 5 * 1024 * 1024
DATA_UPLOAD_MAX_MEMORY_SIZE = 10 * 1024 * 1024
MAX_IMAGE_UPLOAD_MB = int(env("MAX_IMAGE_UPLOAD_MB", "5"))
MAX_DOCUMENT_UPLOAD_MB = int(env("MAX_DOCUMENT_UPLOAD_MB", "10"))

# ---------------------------------------------------------------------------
# Cifrado de datos sensibles en base de datos
# ---------------------------------------------------------------------------
# Clave Fernet (base64 urlsafe de 32 bytes). Generar con:
#   python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
FIELD_ENCRYPTION_KEY = env("FIELD_ENCRYPTION_KEY", "")
# Clave para índices ciegos (HMAC) que permiten búsquedas/unicidad sobre datos cifrados.
BLIND_INDEX_KEY = env("BLIND_INDEX_KEY", SECRET_KEY)

# ---------------------------------------------------------------------------
# Django REST Framework + JWT
# ---------------------------------------------------------------------------
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
        "apps.legal.permissions.HasAcceptedCurrentTerms",
    ],
    "DEFAULT_FILTER_BACKENDS": [
        "django_filters.rest_framework.DjangoFilterBackend",
        "rest_framework.filters.SearchFilter",
        "rest_framework.filters.OrderingFilter",
    ],
    "DEFAULT_PAGINATION_CLASS": "apps.core.pagination.StandardPagination",
    "PAGE_SIZE": 25,
    "DEFAULT_THROTTLE_CLASSES": [
        "rest_framework.throttling.AnonRateThrottle",
        "rest_framework.throttling.UserRateThrottle",
    ],
    "DEFAULT_THROTTLE_RATES": {
        "anon": env("THROTTLE_ANON", "120/min"),
        "user": env("THROTTLE_USER", "600/min"),
        "login": env("THROTTLE_LOGIN", "5/min"),
    },
    "EXCEPTION_HANDLER": "apps.core.exceptions.api_exception_handler",
    "DATETIME_FORMAT": "iso-8601",
    "TEST_REQUEST_DEFAULT_FORMAT": "json",
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=int(env("JWT_ACCESS_MINUTES", "15"))),
    "REFRESH_TOKEN_LIFETIME": timedelta(hours=int(env("JWT_REFRESH_HOURS", "12"))),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    "UPDATE_LAST_LOGIN": True,
    "ALGORITHM": "HS256",
    "SIGNING_KEY": env("JWT_SIGNING_KEY", SECRET_KEY),
    "AUTH_HEADER_TYPES": ("Bearer",),
    "USER_AUTHENTICATION_RULE": "apps.accounts.auth.user_can_authenticate",
}

# Cookie httpOnly para el refresh token (nunca accesible desde JavaScript).
AUTH_REFRESH_COOKIE = "futowl_refresh"
AUTH_REFRESH_COOKIE_PATH = "/api/auth/"
AUTH_REFRESH_COOKIE_SECURE = env_bool("AUTH_COOKIE_SECURE", not DEBUG)
AUTH_REFRESH_COOKIE_SAMESITE = env("AUTH_COOKIE_SAMESITE", "Strict")

# Bloqueo de cuentas tras intentos fallidos
LOGIN_MAX_FAILED_ATTEMPTS = int(env("LOGIN_MAX_FAILED_ATTEMPTS", "5"))
LOGIN_LOCKOUT_MINUTES = int(env("LOGIN_LOCKOUT_MINUTES", "15"))

# ---------------------------------------------------------------------------
# CORS / CSRF
# ---------------------------------------------------------------------------
CORS_ALLOWED_ORIGINS = env_list("CORS_ALLOWED_ORIGINS", "http://localhost:5173")
CORS_ALLOW_CREDENTIALS = True
CSRF_TRUSTED_ORIGINS = env_list("CSRF_TRUSTED_ORIGINS", "http://localhost:5173")
CSRF_TRUSTED_ORIGINS += [f"https://{host}" for host in VERCEL_HOSTS]

# ---------------------------------------------------------------------------
# Seguridad
# ---------------------------------------------------------------------------
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_REFERRER_POLICY = "strict-origin-when-cross-origin"
SECURE_CROSS_ORIGIN_OPENER_POLICY = "same-origin"
X_FRAME_OPTIONS = "DENY"
SESSION_COOKIE_HTTPONLY = True
CSRF_COOKIE_HTTPONLY = True

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {"simple": {"format": "[{asctime}] {levelname} {name}: {message}", "style": "{"}},
    "handlers": {"console": {"class": "logging.StreamHandler", "formatter": "simple"}},
    "root": {"handlers": ["console"], "level": env("LOG_LEVEL", "INFO")},
}

# Ruta del panel de administración de Django (cámbiela en producción para ocultarla)
ADMIN_URL = env("DJANGO_ADMIN_URL", "admin/")
