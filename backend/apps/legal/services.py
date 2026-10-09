from .models import TermsAcceptance, TermsVersion


def current_terms() -> TermsVersion | None:
    return TermsVersion.objects.order_by("-created_at").first()


def has_accepted_current_terms(user) -> bool:
    terms = current_terms()
    if terms is None:
        return True
    return TermsAcceptance.objects.filter(user=user, terms=terms).exists()
