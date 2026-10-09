"""Constructores de los documentos oficiales del torneo."""
from .blocks import PageBreak, Paragraph, Signatures, Spacer, Subtitle, Table, Title

LINEUP_HEADERS = ["ID", "Cédula", "Apellidos y nombres", "F. nac.", "Dorsal", "Convocado (X)", "Titular (X)",
                  "Capitán (X)"]


def _safe(text) -> str:
    """Texto plano; cada renderizador se encarga de escaparlo según su formato."""
    return str(text or "")


def lineup_sheet(tournament, team, category, roster, *, match=None, lineup=None, coaches=()):
    """
    Planilla de alineación. Lista la nómina completa; si existe una alineación
    cargada, marca convocados/titulares. Esta misma tabla se usa para la importación.
    """
    selected = {}
    if lineup is not None:
        selected = {lp.team_player_id: lp for lp in lineup.players.all()}
    rows = []
    for membership in roster:
        player = membership.player
        chosen = selected.get(membership.id)
        rows.append([
            membership.id,
            _safe(player.vat_display or "Partida"),
            _safe(f"{player.last_name}, {player.first_name}"),
            player.birth_date.strftime("%d/%m/%Y"),
            (chosen.shirt_number if chosen else membership.shirt_number) or "",
            "X" if chosen else "",
            "X" if chosen and chosen.is_starter else "",
            "X" if chosen and chosen.is_captain else "",
        ])
    blocks = [
        Title(f"Planilla de alineación · {_safe(tournament.name)}"),
        Paragraph(f"Equipo: {_safe(team.name)}  |  RIF: {_safe(team.vat_display)}  |  Categoría: "
                  f"{_safe(category.name)}", bold=True),
    ]
    if match is not None:
        blocks.append(Paragraph(
            f"Partido: {_safe(match.home.team.name)} vs {_safe(match.away.team.name)}  |  "
            f"Fecha: {match.local_start:%d/%m/%Y %H:%M}  |  Cancha: {_safe(match.field)}"
            if match.scheduled_start else f"Partido: {_safe(match)}"
        ))
    blocks += [
        Paragraph(f"Cuerpo técnico: {_safe(', '.join(c.full_name for c in coaches)) or '—'}"),
        Paragraph(f"Máximo {tournament.max_lineup_players} jugadores convocados, "
                  f"{tournament.starters_count} titulares."),
        Spacer(),
        Table(LINEUP_HEADERS, rows, widths=[0.6, 1.4, 3.2, 1.2, 0.8, 1.1, 1, 1]),
        Spacer(16),
        Signatures(["Entrenador", "Delegado del equipo", "Delegado de mesa técnica"]),
    ]
    return blocks


def substitution_cards(tournament, team, category, *, count: int = 6, match=None):
    blocks = [Title(f"Tarjetas de cambio · {_safe(tournament.name)}")]
    for index in range(1, count + 1):
        if index > 1 and index % 3 == 1:
            blocks.append(PageBreak())
        blocks += [
            Subtitle(f"Tarjeta de cambio N.º {index}"),
            Paragraph(f"Equipo: {_safe(team.name)}  |  Categoría: {_safe(category.name)}"
                      + (f"  |  Partido: {_safe(match)}" if match else "")),
            Table(["", "Dorsal", "Apellidos y nombres"], [["SALE", "", ""], ["ENTRA", "", ""]],
                  widths=[1, 1, 5]),
            Paragraph("Minuto: ______   Tiempo: ______"),
            Signatures(["Entrenador", "Delegado de mesa"]),
            Spacer(14),
        ]
    return blocks


def regulation(tournament):
    blocks = [Title(f"Reglamento · {_safe(tournament.name)}")]
    blocks.append(Paragraph(
        f"Modalidad: {tournament.get_modality_display()}  |  Duración: {tournament.match_duration_minutes} min "
        f"en {tournament.periods} tiempos  |  Puntos: G {tournament.points_win} / E {tournament.points_draw} / "
        f"P {tournament.points_loss}", bold=True))
    blocks.append(Spacer())
    text = tournament.regulation_text or "El reglamento de este torneo aún no ha sido redactado."
    for raw in text.splitlines():
        line = raw.strip()
        if not line:
            continue
        if line.startswith("#"):
            blocks.append(Subtitle(_safe(line.lstrip("#").strip())))
        else:
            blocks.append(Paragraph(_safe(line.lstrip("-* ").strip()) if line[:2] in ("- ", "* ") else _safe(line)))
    return blocks
