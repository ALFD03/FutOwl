from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from .timeutils import now


@api_view(["GET"])
@permission_classes([AllowAny])
@throttle_classes([])
def server_time(request):
    """Hora oficial del servidor (America/Caracas, UTC-4) para sincronizar clientes."""
    local = now()
    return Response(
        {
            "utc": timezone.now().isoformat(),
            "local": local.isoformat(),
            "timezone": "America/Caracas",
            "utc_offset": local.strftime("%z"),
            "epoch_ms": int(local.timestamp() * 1000),
        }
    )


@api_view(["GET"])
@permission_classes([AllowAny])
def health(request):
    return Response({"status": "ok"})
