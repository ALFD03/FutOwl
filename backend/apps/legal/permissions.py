from rest_framework.permissions import BasePermission

from .services import has_accepted_current_terms


class HasAcceptedCurrentTerms(BasePermission):
    """Bloquea el uso de la API hasta aceptar la versión vigente de los términos."""

    message = "Debe aceptar los términos y condiciones vigentes para continuar."

    def has_permission(self, request, view):
        user = request.user
        if not (user and user.is_authenticated):
            return True  # La autenticación se valida en otra clase de permiso
        if getattr(view, "skip_terms_check", False):
            return True
        return has_accepted_current_terms(user)
