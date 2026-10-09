"""Partes involucradas en un partido: quién debe confirmar y quién es quién."""
from django.contrib.auth import get_user_model

from ..models import OFFICIAL_PARTIES, TEAM_PARTIES, Match, MatchConfirmation, Party, ReviewCase


def required_official_parties(match: Match) -> list[str]:
    """Delegado + terna arbitral según lo exigido por el torneo."""
    refs = [Party.REFEREE, Party.ASSISTANT_1, Party.ASSISTANT_2][: match.tournament.referees_required]
    return [Party.DELEGATE, *refs]


def all_parties(match: Match) -> list[str]:
    return required_official_parties(match) + list(TEAM_PARTIES)


def party_user_ids(match: Match, party: str) -> set[int]:
    if party in OFFICIAL_PARTIES:
        official = match.party_official(party)
        return {official.user_id} if official and official.user_id else set()
    team = match.team_for(party)
    return set(team.team.managers.values_list("id", flat=True)) if team else set()


def parties_for_user(match: Match, user) -> list[str]:
    return [p for p in all_parties(match) if user.pk in party_user_ids(match, p)]


def involved_users(match: Match):
    ids = set()
    for party in all_parties(match):
        ids |= party_user_ids(match, party)
    return get_user_model().objects.filter(pk__in=ids, is_active=True)


def party_required_version(match: Match, party: str) -> int:
    """Versión mínima de asignación que debe confirmar la parte (cambia tras ajustes que la afectan)."""
    required = 1
    for adjustment in match.adjustments.all():
        if party in adjustment.affected_parties:
            required = max(required, adjustment.version_to)
    return required


def party_status(match: Match, party: str) -> dict:
    required = party_required_version(match, party)
    latest = (
        MatchConfirmation.objects.filter(match=match, party=party).order_by("-created_at", "-id").first()
    )
    valid = latest is not None and latest.assignment_version >= required
    open_case = ReviewCase.objects.filter(
        match=match, confirmation__party=party, status=ReviewCase.Status.OPEN
    ).exists()
    return {
        "party": party,
        "label": Party(party).label,
        "required_version": required,
        "response": latest.response if valid else None,
        "reason": latest.reason if valid else "",
        "responded_at": latest.created_at if valid else None,
        "under_review": open_case,
    }


def confirmation_summary(match: Match) -> list[dict]:
    return [party_status(match, party) for party in all_parties(match)]


def officials_confirmed(match: Match) -> bool:
    return all(
        party_status(match, p)["response"] == MatchConfirmation.Response.ACCEPTED
        for p in required_official_parties(match)
    )
