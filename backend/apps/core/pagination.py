from django.db.models import QuerySet
from rest_framework.pagination import PageNumberPagination

TIEBREAKERS = {"pk", "-pk", "id", "-id"}


class StandardPagination(PageNumberPagination):
    page_size_query_param = "page_size"
    max_page_size = 200

    def paginate_queryset(self, queryset, request, view=None):
        # Con un orden no único (p. ej. apellido) la base de datos puede repetir u omitir filas
        # entre páginas; la clave primaria como desempate hace estable el paginado.
        if isinstance(queryset, QuerySet):
            ordering = list(queryset.query.order_by or (queryset.query.default_ordering and queryset.model._meta.ordering) or [])
            if not TIEBREAKERS.intersection(o for o in ordering if isinstance(o, str)):
                queryset = queryset.order_by(*ordering, "pk")
        return super().paginate_queryset(queryset, request, view)
