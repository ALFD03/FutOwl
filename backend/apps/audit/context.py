"""Contexto de la petición actual (usuario, IP, agente) para los registros de auditoría."""
from contextvars import ContextVar

_current_request: ContextVar = ContextVar("futowl_current_request", default=None)


def set_request(request):
    return _current_request.set(request)


def reset_request(token):
    _current_request.reset(token)


def get_request():
    return _current_request.get()


def client_ip(request) -> str | None:
    forwarded = request.META.get("HTTP_X_FORWARDED_FOR")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR")


def current_user():
    request = get_request()
    user = getattr(request, "user", None) if request is not None else None
    return user if user is not None and user.is_authenticated else None
