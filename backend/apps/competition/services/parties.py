"""Partes involucradas en un partido: quién debe confirmar y quién es quién."""
from collections import defaultdict

from django.contrib.auth import get_user_model

from ..models import OFFICIAL_PARTIES, TEAM_PARTIES, Match, MatchAdjustment, MatchConfirmation, Party, ReviewCase


def required_official_parties(match: Match) -> list[str]:
    """Delegado + terna arbitral según lo exigido por las reglas de la categoría."""
    refs = [Party.REFEREE, Party.ASSISTANT_1, Party.ASSISTANT_2][: match.rules.referees_required]
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


def my_confirmations(matches, user) -> dict[int, str]:
    """
    Estado de la respuesta del usuario en cada partido donde es parte (oficial asignado o gestor de un equipo):
    `accepted`, `rejected`, `review` (su rechazo está en revisión) o `pending`. Se calcula en bloque para un
    listado; los partidos donde no participa, o que aún no esperan confirmación sin haberla, no aparecen.
    """
    matches = list(matches)
    if not matches or not user.is_authenticated:
        return {}
    team_ids = set(user.managed_teams.values_list("id", flat=True))
    mine = {}
    for match in matches:
        parties = [p for p in required_official_parties(match)
                   if (official := match.party_official(p)) and official.user_id == user.pk]
        parties += [p for p in TEAM_PARTIES if (team := match.team_for(p)) and team.team_id in team_ids]
        if parties:
            mine[match.pk] = parties
    if not mine:
        return {}

    required = defaultdict(lambda: 1)
    for adjustment in MatchAdjustment.objects.filter(match_id__in=mine).only("match_id", "version_to", "affected_parties"):
        for party in adjustment.affected_parties:
            key = (adjustment.match_id, party)
            required[key] = max(required[key], adjustment.version_to)
    latest = {}
    for confirmation in MatchConfirmation.objects.filter(match_id__in=mine).order_by("created_at", "id"):
        latest[(confirmation.match_id, confirmation.party)] = confirmation
    in_review = set(ReviewCase.objects.filter(match_id__in=mine, status=ReviewCase.Status.OPEN)
                    .exclude(confirmation=None).values_list("match_id", "confirmation__party"))

    awaiting = {Match.Status.PENDING, Match.Status.CONFIRMED}
    result = {}
    for match in matches:
        states = set()
        for party in mine.get(match.pk, []):
            key = (match.pk, party)
            confirmation = latest.get(key)
            if key in in_review:
                states.add("review")
            elif confirmation and confirmation.assignment_version >= required[key]:
                states.add(confirmation.response)
            else:
                states.add("pending")
        if not states:
            continue
        state = next(s for s in ("review", "rejected", "pending", MatchConfirmation.Response.ACCEPTED) if s in states)
        if state == "pending" and match.status not in awaiting:
            continue
        result[match.pk] = state
    return result
