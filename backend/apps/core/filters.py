"""Búsqueda por texto que además encuentra registros por su documento (cifrado) vía índice ciego."""
import re

from django.db.models import Q
from rest_framework.filters import SearchFilter

from .models import VatType

MIN_DOCUMENT_DIGITS = 5


def document_hashes(model, term: str) -> list[str]:
    """Hashes del documento buscado. «V-12345678» busca ese tipo; solo dígitos prueba todos los tipos."""
    digits = re.sub(r"\D", "", term)
    if len(digits) < MIN_DOCUMENT_DIGITS:
        return []
    prefix = term.strip()[:1].upper()
    types = [prefix] if prefix in VatType.values else list(VatType.values)
    return [model(vat_id=t, vat_number=digits).compute_vat_hash() for t in types]


class IdentitySearchFilter(SearchFilter):
    """`?search=` busca en los campos de texto y, si el modelo tiene documento, también por cédula/RIF."""

    def filter_queryset(self, request, queryset, view):
        result = super().filter_queryset(request, queryset, view)
        model = queryset.model
        if not hasattr(model, "compute_vat_hash"):
            return result
        hashes = [h for term in self.get_search_terms(request) for h in document_hashes(model, term)]
        if not hashes:
            return result
        return queryset.filter(Q(pk__in=result.values("pk")) | Q(vat_hash__in=hashes))
