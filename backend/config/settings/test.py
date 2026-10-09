from .base import *  # noqa: F401,F403

DATABASES = {"default": {"ENGINE": "django.db.backends.sqlite3", "NAME": ":memory:"}}
PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]
FIELD_ENCRYPTION_KEY = "xHw_6oWkvpVtzCNSpqr9u4IuYJnpEWthKC4hB3Xmny0="
REST_FRAMEWORK = {**REST_FRAMEWORK, "DEFAULT_THROTTLE_CLASSES": []}  # noqa: F405
MEDIA_ROOT = BASE_DIR / "test_media"  # noqa: F405
AUTH_REFRESH_COOKIE_SECURE = False
SECRET_KEY = "test-secret-key-only-for-automated-tests-0123456789"
SIMPLE_JWT = {**SIMPLE_JWT, "SIGNING_KEY": SECRET_KEY}  # noqa: F405
LOGGING = {**LOGGING, "loggers": {"django.request": {"level": "ERROR"}}}  # noqa: F405
STORAGES = {**STORAGES, "staticfiles": {"BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage"}}  # noqa: F405
