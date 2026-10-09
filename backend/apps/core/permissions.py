"""
Protección de APIs y funciones.

- `ModelActionPermission`: exige los permisos de Django (view/add/change) según la acción.
- `require_perms`: decorador para acciones/vistas/servicios que exigen permisos concretos.
- `require_authenticated`: decorador para funciones que requieren un usuario autenticado.
"""
from functools import wraps

from rest_framework.exceptions import NotAuthenticated, PermissionDenied
from rest_framework.permissions import SAFE_METHODS, BasePermission

STANDARD_ACTION_PERMS = {
    "list": "view",
    "retrieve": "view",
    "create": "add",
    "update": "change",
    "partial_update": "change",
    "destroy": "delete",
    "metadata": "view",
}


def _perm(model, action: str) -> str:
    return f"{model._meta.app_label}.{action}_{model._meta.model_name}"


class ModelActionPermission(BasePermission):
    """
    Permisos por acción del ViewSet.
    - Acciones estándar → permisos de modelo (view/add/change/delete).
    - Acciones personalizadas decoradas con `require_perms` → se validan en el decorador
      (aquí solo se exige autenticación).
    - Acciones personalizadas sin decorador → `view` para lectura, `change` para escritura.
    """

    def has_permission(self, request, view):
        user = request.user
        if not (user and user.is_authenticated):
            return False
        if user.is_superuser:
            return True
        queryset = getattr(view, "queryset", None)
        if queryset is None:
            return True
        model = queryset.model
        action = getattr(view, "action", None)
        if action in STANDARD_ACTION_PERMS:
            return user.has_perm(_perm(model, STANDARD_ACTION_PERMS[action]))
        handler = getattr(view, action, None) if action else None
        if handler is not None and getattr(handler, "required_perms", None):
            return True
        return user.has_perm(_perm(model, "view" if request.method in SAFE_METHODS else "change"))


def _find_request(args):
    for arg in args[:2]:
        if hasattr(arg, "user") and hasattr(arg, "method"):
            return arg
    return None


def _find_user(args, kwargs):
    request = _find_request(args)
    if request is not None:
        return request.user
    return kwargs.get("user") or kwargs.get("actor")


def require_perms(*perms: str, any_of: bool = False):
    """
    Decorador de protección. Uso:

        @action(detail=True, methods=["post"])
        @require_perms("competition.close_match")
        def close(self, request, pk=None): ...

    También funciona sobre funciones de servicio que reciben `user=`/`actor=`.
    """

    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            user = _find_user(args, kwargs)
            if user is None or not user.is_authenticated:
                raise NotAuthenticated("Debe iniciar sesión.")
            check = any if any_of else all
            if not user.is_superuser and not check(user.has_perm(p) for p in perms):
                raise PermissionDenied("No tiene permisos para realizar esta acción.")
            return func(*args, **kwargs)

        wrapper.required_perms = perms
        return wrapper

    return decorator


def require_authenticated(func):
    @wraps(func)
    def wrapper(*args, **kwargs):
        user = _find_user(args, kwargs)
        if user is None or not user.is_authenticated:
            raise NotAuthenticated("Debe iniciar sesión.")
        return func(*args, **kwargs)

    wrapper.required_perms = ("authenticated",)
    return wrapper
