"""Carga, importación y verificación de alineaciones."""
import csv
import io
import os

from django.core.exceptions import PermissionDenied, ValidationError
from django.db import transaction
from docx import Document

from apps.audit.services import record
from apps.registry.models import TeamPlayer

from ..models import Lineup, LineupPlayer, Match

EDITABLE_MATCH_STATUSES = (Match.Status.PENDING, Match.Status.CONFIRMED)


def can_manage_team(user, tournament_team) -> bool:
    if user.is_superuser or user.has_perm("competition.operate_any_match"):
        return True
    return tournament_team.team.managers.filter(pk=user.pk).exists()


def _team_for(match: Match, team_id: int):
    if team_id == match.home_id:
        return match.home
    if team_id == match.away_id:
        return match.away
    raise ValidationError({"team": "El equipo no participa en este partido."})


def _validate_players(match: Match, tournament_team, players: list[dict]) -> list[dict]:
    tournament = match.tournament
    if not players:
        raise ValidationError({"players": "Debe seleccionar al menos un jugador."})
    if len(players) > tournament.max_lineup_players:
        raise ValidationError({"players": f"Máximo {tournament.max_lineup_players} jugadores por planilla."})
    starters = [p for p in players if p.get("is_starter")]
    if len(starters) > tournament.starters_count:
        raise ValidationError({"players": f"Máximo {tournament.starters_count} titulares."})
    if sum(1 for p in players if p.get("is_captain")) > 1:
        raise ValidationError({"players": "Solo puede haber un capitán."})
    numbers = [p["shirt_number"] for p in players]
    if len(numbers) != len(set(numbers)):
        raise ValidationError({"players": "Hay dorsales repetidos."})
    ids = [p["team_player"] for p in players]
    if len(ids) != len(set(ids)):
        raise ValidationError({"players": "Hay jugadores repetidos."})
    valid = set(
        TeamPlayer.objects.filter(
            pk__in=ids, team_id=tournament_team.team_id, category_id=tournament_team.category_id, is_active=True,
            player__is_active=True,
        ).values_list("id", flat=True)
    )
    invalid = [i for i in ids if i not in valid]
    if invalid:
        raise ValidationError({"players": f"Jugadores no inscritos en la nómina de la categoría: {invalid}"})
    return players


@transaction.atomic
def submit_lineup(match: Match, team_id: int, user, players: list[dict], coach=None, sheet_file=None) -> Lineup:
    match = Match.objects.select_for_update().get(pk=match.pk)
    tournament_team = _team_for(match, team_id)
    if not can_manage_team(user, tournament_team):
        raise PermissionDenied("Solo los gestores del equipo pueden cargar su alineación.")
    if match.status not in EDITABLE_MATCH_STATUSES or match.phase != Match.Phase.NOT_STARTED:
        raise ValidationError("La alineación solo puede cargarse antes del inicio del partido.")
    if coach is not None and not tournament_team.team.coaches.filter(pk=coach.pk).exists():
        raise ValidationError({"coach": "El entrenador no pertenece al equipo."})
    players = _validate_players(match, tournament_team, players)

    lineup = Lineup.objects.filter(match=match, team=tournament_team).first()
    if lineup and lineup.status == Lineup.Status.VERIFIED:
        raise ValidationError("La alineación ya fue verificada en mesa técnica y no puede modificarse.")
    if lineup is None:
        lineup = Lineup(match=match, team=tournament_team, submitted_by=user)
    lineup.submitted_by = user
    lineup.coach = coach
    if sheet_file:
        lineup.sheet_file = sheet_file
    lineup.save()
    lineup.players.all().delete()
    LineupPlayer.objects.bulk_create([
        LineupPlayer(
            lineup=lineup,
            team_player_id=p["team_player"],
            shirt_number=p["shirt_number"],
            is_starter=bool(p.get("is_starter")),
            is_captain=bool(p.get("is_captain")),
        )
        for p in players
    ])
    record("submit_lineup", lineup, user=user, changes={"jugadores": len(players)})
    return lineup


# ---------------------------------------------------------------------------
# Importación de la planilla (DOCX generado por FutOwl o CSV con las mismas columnas)
# ---------------------------------------------------------------------------
def _is_marked(value: str) -> bool:
    return value.strip().lower() in {"x", "si", "sí", "1", "true", "✓"}


def _rows_from_docx(file) -> list[list[str]]:
    document = Document(file)
    for table in document.tables:
        header = [c.text.strip().lower() for c in table.rows[0].cells]
        if header and header[0] == "id":
            return [[c.text.strip() for c in row.cells] for row in table.rows]
    raise ValidationError("No se encontró la tabla de la planilla en el documento.")


def _rows_from_csv(file) -> list[list[str]]:
    content = file.read().decode("utf-8-sig")
    dialect = csv.Sniffer().sniff(content.splitlines()[0], delimiters=",;")
    return [row for row in csv.reader(io.StringIO(content), dialect)]


def parse_lineup_file(file) -> list[dict]:
    """
    Lee la planilla de alineación y devuelve los jugadores convocados.
    Columnas esperadas: ID | Cédula | Apellidos y nombres | F. nac. | Dorsal | Convocado | Titular | Capitán
    """
    ext = os.path.splitext(file.name)[1].lower()
    if ext == ".docx":
        rows = _rows_from_docx(file)
    elif ext == ".csv":
        rows = _rows_from_csv(file)
    else:
        raise ValidationError("Formato no soportado para importar. Use la planilla .docx o .csv de FutOwl.")
    header = [h.strip().lower() for h in rows[0]]

    def col(prefix):
        for idx, name in enumerate(header):
            if name.startswith(prefix):
                return idx
        raise ValidationError(f"Columna '{prefix}' no encontrada en la planilla.")

    i_id, i_num, i_call, i_start, i_capt = col("id"), col("dorsal"), col("convocado"), col("titular"), col("capit")
    players = []
    for row in rows[1:]:
        if len(row) <= max(i_id, i_num, i_call, i_start, i_capt) or not _is_marked(row[i_call]):
            continue
        try:
            players.append({
                "team_player": int(row[i_id]),
                "shirt_number": int(row[i_num]),
                "is_starter": _is_marked(row[i_start]),
                "is_captain": _is_marked(row[i_capt]),
            })
        except ValueError as exc:
            raise ValidationError(f"Fila inválida en la planilla (ID/dorsal): {row[:5]}") from exc
    return players
