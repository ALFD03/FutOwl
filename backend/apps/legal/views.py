from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from apps.audit.context import client_ip
from apps.audit.services import record
from apps.core.permissions import require_perms

from .models import TermsAcceptance
from .serializers import TermsVersionSerializer
from .services import current_terms


@api_view(["GET"])
@permission_classes([AllowAny])
def current_terms_view(request):
    terms = current_terms()
    if terms is None:
        return Response({"detail": "No hay términos publicados."}, status=status.HTTP_404_NOT_FOUND)
    return Response(TermsVersionSerializer(terms).data)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def accept_terms_view(request):
    terms = current_terms()
    if terms is None:
        return Response({"detail": "No hay términos publicados."}, status=status.HTTP_404_NOT_FOUND)
    acceptance, created = TermsAcceptance.objects.get_or_create(
        user=request.user,
        terms=terms,
        defaults={"ip_address": client_ip(request), "user_agent": request.META.get("HTTP_USER_AGENT", "")[:255]},
    )
    if created:
        record("accept_terms", acceptance, user=request.user, changes={"version": terms.version})
    return Response({"detail": "Términos aceptados.", "version": terms.version})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
@require_perms("legal.add_termsversion")
def publish_terms_view(request):
    serializer = TermsVersionSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    terms = serializer.save(published_by=request.user)
    return Response(TermsVersionSerializer(terms).data, status=status.HTTP_201_CREATED)
