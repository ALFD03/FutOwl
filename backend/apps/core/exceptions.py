from django.core.exceptions import ValidationError as DjangoValidationError
from django.db.models import ProtectedError, RestrictedError
from rest_framework import status
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import exception_handler


def api_exception_handler(exc, context):
    """Convierte errores de validación de modelo en respuestas 400 coherentes."""
    if isinstance(exc, (ProtectedError, RestrictedError)):
        # Un borrado bloqueado por registros relacionados no es un error del servidor: se explica qué lo impide.
        related = getattr(exc, "protected_objects", None) or getattr(exc, "restricted_objects", ())
        blocking = sorted({str(obj._meta.verbose_name_plural) for obj in related if hasattr(obj, "_meta")})
        return conflict("No se puede eliminar: tiene registros asociados" + (f" ({', '.join(blocking)})." if blocking else "."))
    if isinstance(exc, DjangoValidationError):
        detail = exc.message_dict if hasattr(exc, "error_dict") else {"detail": exc.messages}
        exc = ValidationError(detail)
    response = exception_handler(exc, context)
    if response is None:
        return None
    if isinstance(response.data, list):
        response.data = {"detail": response.data}
    return response


def conflict(message: str) -> Response:
    return Response({"detail": message}, status=status.HTTP_409_CONFLICT)
