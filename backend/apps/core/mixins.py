"""Mixins de ViewSet: registro del creador, desactivación (sin borrado) y auditoría."""
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.audit.services import record

from .permissions import ModelActionPermission


class NoDeleteModelViewSet(
    mixins.CreateModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    mixins.ListModelMixin,
    viewsets.GenericViewSet,
):
    """CRUD sin borrado físico. Los registros se desactivan/reactivan."""

    permission_classes = viewsets.GenericViewSet.permission_classes + [ModelActionPermission]

    def perform_create(self, serializer):
        model = serializer.Meta.model
        extra = {"created_by": self.request.user} if hasattr(model, "created_by") else {}
        serializer.save(**extra)

    def _set_active(self, request, value: bool):
        instance = self.get_object()
        instance.is_active = value
        instance.save(update_fields=["is_active", "updated_at"])
        record(
            "activate" if value else "deactivate",
            instance,
            user=request.user,
            changes={"is_active": value},
        )
        return Response(self.get_serializer(instance).data, status=status.HTTP_200_OK)

    # Sin decorador: ModelActionPermission exige el permiso `change` del modelo.
    @action(detail=True, methods=["post"])
    def deactivate(self, request, pk=None):
        return self._set_active(request, False)

    @action(detail=True, methods=["post"])
    def activate(self, request, pk=None):
        return self._set_active(request, True)
