from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.core.permissions import ModelActionPermission, require_perms

from .models import AuditLog
from .serializers import AuditLogSerializer
from .services import verify_chain


class AuditLogViewSet(viewsets.ReadOnlyModelViewSet):
    """Consulta de la bitácora (solo lectura)."""

    queryset = AuditLog.objects.select_related("user")
    serializer_class = AuditLogSerializer
    permission_classes = viewsets.ReadOnlyModelViewSet.permission_classes + [ModelActionPermission]
    filterset_fields = ["action", "app_label", "model", "object_id", "user"]
    search_fields = ["username", "object_repr", "action", "model"]
    ordering_fields = ["id", "created_at"]

    @action(detail=False, methods=["get"])
    @require_perms("audit.verify_auditlog")
    def verify(self, request):
        return Response(verify_chain())
