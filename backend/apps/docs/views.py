from django.contrib.auth.models import Group
from django.db import transaction
from rest_framework import mixins, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import SAFE_METHODS, BasePermission
from rest_framework.response import Response

from apps.accounts.serializers import PermissionSerializer
from apps.accounts.views import PermissionViewSet

from .models import DocPage, DocRevision
from .serializers import DocPageListSerializer, DocPageSerializer, DocRevisionSerializer


class IsSuperuserOrReadOnly(BasePermission):
    """Cualquier usuario autenticado lee la documentación; solo el superusuario la edita."""

    message = "Solo el superadministrador puede editar la documentación."

    def has_permission(self, request, view):
        return request.method in SAFE_METHODS or bool(request.user and request.user.is_superuser)


class DocPageViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.CreateModelMixin,
    mixins.UpdateModelMixin,
    viewsets.GenericViewSet,
):
    """Páginas de documentación en Markdown (sin borrado: se despublican)."""

    permission_classes = viewsets.GenericViewSet.permission_classes + [IsSuperuserOrReadOnly]
    lookup_field = "slug"
    pagination_class = None
    filterset_fields = ["section"]
    search_fields = ["title", "summary", "content"]

    def get_queryset(self):
        qs = DocPage.objects.select_related("updated_by")
        return qs if self.request.user.is_superuser else qs.filter(is_active=True)

    def get_serializer_class(self):
        return DocPageListSerializer if self.action == "list" else DocPageSerializer

    @transaction.atomic
    def perform_create(self, serializer):
        user = self.request.user
        page = serializer.save(created_by=user, updated_by=user)
        DocRevision.objects.create(page=page, title=page.title, content=page.content, edited_by=user)

    @transaction.atomic
    def perform_update(self, serializer):
        before = (serializer.instance.title, serializer.instance.content)
        page = serializer.save(updated_by=self.request.user)
        if (page.title, page.content) != before:
            DocRevision.objects.create(page=page, title=page.title, content=page.content, edited_by=self.request.user)

    @action(detail=True, methods=["get"])
    def revisions(self, request, slug=None):
        if not request.user.is_superuser:
            raise PermissionDenied("Solo el superadministrador consulta el historial.")
        page = self.get_object()
        return Response(DocRevisionSerializer(page.revisions.select_related("edited_by")[:50], many=True).data)

    @action(detail=False, methods=["get"], url_path="permission-catalog")
    def permission_catalog(self, request):
        """Catálogo de permisos y roles vigentes (para la sección de permisos de la documentación)."""
        permissions = PermissionViewSet.queryset.all()
        roles = Group.objects.prefetch_related("permissions__content_type").order_by("name")
        return Response({
            "permissions": PermissionSerializer(permissions, many=True).data,
            "roles": [
                {
                    "id": role.id,
                    "name": role.name,
                    "user_count": role.user_set.count(),
                    "permissions": sorted(f"{p.content_type.app_label}.{p.codename}" for p in role.permissions.all()),
                }
                for role in roles
            ],
        })
