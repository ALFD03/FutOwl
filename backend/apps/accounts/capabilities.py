"""
Capacidades: los permisos que se asignan a roles y usuarios, expresados como funciones reales.

Cada capacidad agrupa los permisos técnicos de Django que necesita (`grants`). Las validaciones del
código siguen usando esos permisos técnicos; las capacidades solo ordenan qué se asigna y cómo se explica.
Los permisos técnicos que no aparecen aquí no habilitan nada por sí solos y no se asignan.
"""
from dataclasses import dataclass


@dataclass(frozen=True)
class Capability:
    code: str
    area: str
    label: str
    description: str
    grants: tuple[str, ...]


AREAS = ["Consulta", "Registro", "Torneos", "Programación", "Día de partido", "Informes y cierre", "Administración"]


def _crud(app: str, *models: str, actions=("add", "change")) -> tuple[str, ...]:
    return tuple(f"{app}.{action}_{model}" for model in models for action in actions)


CAPABILITIES: list[Capability] = [
    # ---------------------------------------------------------------- Consulta
    Capability("ver_registro", "Consulta", "Consultar el registro",
               "Ver categorías, canchas, equipos, jugadores, representantes, entrenadores, delegados y árbitros.",
               _crud("registry", "category", "field", "team", "player", "guardian", "coach", "delegate", "referee",
                     actions=("view",))),
    Capability("ver_competicion", "Consulta", "Consultar torneos y partidos",
               "Ver torneos, reglas, inscripciones, nóminas, jornadas, la ficha completa de los partidos "
               "(confirmaciones, alineaciones, cronología, informes y notas) y las revisiones.",
               _crud("tournaments", "tournament", "categoryrules", "group", "tournamentteam", "teamplayer",
                     actions=("view",)) + _crud("competition", "matchday", "match", "reviewcase", actions=("view",))),
    # ---------------------------------------------------------------- Registro
    Capability("gestionar_categorias", "Registro", "Gestionar categorías",
               "Crear, editar y activar o desactivar categorías.", _crud("registry", "category")),
    Capability("gestionar_canchas", "Registro", "Gestionar canchas",
               "Crear, editar y activar o desactivar canchas.", _crud("registry", "field")),
    Capability("administrar_equipos", "Registro", "Administrar todos los equipos",
               "Crear clubes y editar cualquier equipo: datos, categorías, usuarios de acceso, plantilla, cuerpo "
               "técnico y nómina. Sin esta capacidad, cada gestor o entrenador solo maneja lo de su equipo.",
               _crud("registry", "team")),
    Capability("gestionar_plantilla", "Registro", "Gestionar plantilla",
               "Registrar y editar jugadores y sus representantes (de sus equipos, salvo que administre todos).",
               _crud("registry", "player", "guardian")),
    Capability("gestionar_entrenadores", "Registro", "Gestionar entrenadores",
               "Registrar, editar, asignar y liberar entrenadores (de sus equipos, salvo que administre todos).",
               _crud("registry", "coach")),
    Capability("gestionar_delegados", "Registro", "Gestionar delegados",
               "Registrar, editar y activar o desactivar delegados.", _crud("registry", "delegate")),
    Capability("gestionar_arbitros", "Registro", "Gestionar árbitros",
               "Registrar, editar y activar o desactivar árbitros.", _crud("registry", "referee")),
    # ---------------------------------------------------------------- Torneos
    Capability("gestionar_torneos", "Torneos", "Gestionar torneos",
               "Crear torneos; editar sus datos, estado, puntuación, ajustes de reglas por categoría, reglamento y "
               "documentos; y eliminar definitivamente los que siguen en borrador.",
               _crud("tournaments", "tournament", "categoryrules") + ("tournaments.delete_tournament",)),
    Capability("inscripciones", "Torneos", "Inscripciones y grupos",
               "Inscribir equipos en los torneos por categoría y armar los grupos.",
               _crud("tournaments", "tournamentteam", "group")),
    Capability("gestionar_nomina", "Torneos", "Gestionar nómina",
               "Inscribir jugadores en la nómina de un torneo, cambiar dorsales y dar de baja (de sus equipos, "
               "salvo que administre todos los equipos o gestione torneos).",
               _crud("tournaments", "teamplayer")),
    # ---------------------------------------------------------------- Programación
    Capability("armar_fixture", "Programación", "Armar el fixture",
               "Generar el fixture automáticamente y crear o eliminar partidos en borrador.",
               ("competition.generate_fixture", "competition.add_match", "competition.delete_match")),
    Capability("programar_partidos", "Programación", "Programar jornadas y partidos",
               "Crear y eliminar jornadas en borrador, agregar o quitar partidos y asignar cancha, horario, "
               "delegado y terna arbitral.",
               _crud("competition", "matchday", actions=("add", "change", "delete")) + ("competition.change_match",)),
    Capability("asignar_delegados", "Programación", "Asignar delegados",
               "Elegir el delegado de cada partido en las jornadas en borrador y, ya enviada la jornada, "
               "reemplazarlo con exposición de motivos. No cambia cancha ni horario.",
               ("competition.assign_delegate",)),
    Capability("asignar_arbitros", "Programación", "Asignar árbitros",
               "Elegir la terna arbitral de cada partido en las jornadas en borrador y, ya enviada la jornada, "
               "reemplazarla con exposición de motivos. No cambia cancha ni horario.",
               ("competition.assign_referees",)),
    Capability("enviar_jornadas", "Programación", "Enviar jornadas a confirmación",
               "Bloquear una jornada completa y pedir la confirmación de oficiales y equipos.",
               ("competition.submit_matchday",)),
    Capability("cerrar_jornadas", "Programación", "Cerrar jornadas",
               "Cerrar una jornada cuando terminó.", ("competition.close_matchday",)),
    Capability("ajustar_partidos", "Programación", "Ajustar partidos confirmados",
               "Cambiar cancha, horario u oficiales de un partido ya enviado, con exposición de motivos. "
               "Las partes afectadas vuelven a confirmar.", ("competition.adjust_match",)),
    Capability("suspender_partidos", "Programación", "Suspender partidos",
               "Suspender un partido indicando el motivo.", ("competition.suspend_match",)),
    # ---------------------------------------------------------------- Día de partido
    Capability("confirmar_asistencia", "Día de partido", "Confirmar asistencia",
               "Confirmar o rechazar su asignación a un partido (como oficial o por su equipo).",
               ("competition.confirm_assignment",)),
    Capability("cargar_alineaciones", "Día de partido", "Cargar alineaciones",
               "Cargar o importar la alineación de sus equipos.", ("competition.submit_lineup",)),
    Capability("mesa_tecnica", "Día de partido", "Mesa técnica de sus partidos",
               "Operar la consola de mesa técnica de los partidos donde es el delegado asignado.",
               ("competition.operate_match",)),
    Capability("mesa_tecnica_global", "Día de partido", "Mesa técnica de cualquier partido",
               "Operar la mesa técnica de todos los partidos y cargar la alineación de cualquier equipo.",
               ("competition.operate_any_match",)),
    Capability("notas", "Día de partido", "Notas y apelaciones",
               "Escribir notas y apelaciones en los partidos donde participa (oficial o equipo).",
               ("competition.add_matchnote",)),
    # ---------------------------------------------------------------- Informes y cierre
    Capability("informe_delegado", "Informes y cierre", "Informe del delegado",
               "Enviar el informe del partido como delegado asignado.", ("competition.submit_delegate_report",)),
    Capability("informe_arbitral", "Informes y cierre", "Informe arbitral",
               "Enviar el informe del partido como árbitro principal.", ("competition.submit_referee_report",)),
    Capability("devolver_informes", "Informes y cierre", "Devolver informes",
               "Devolver un informe para que su autor lo corrija.", ("competition.return_report",)),
    Capability("cerrar_partidos", "Informes y cierre", "Cerrar partidos",
               "Cierre oficial del partido con los informes recibidos.", ("competition.close_match",)),
    Capability("resolver_revisiones", "Informes y cierre", "Resolver revisiones",
               "Resolver o desestimar rechazos de asignación y apelaciones; recibe sus avisos.",
               ("competition.resolve_reviewcase",)),
    # ---------------------------------------------------------------- Administración
    Capability("ver_usuarios", "Administración", "Ver usuarios", "Consultar los usuarios.", ("accounts.view_user",)),
    Capability("gestionar_usuarios", "Administración", "Gestionar usuarios",
               "Crear y editar usuarios, sus roles y capacidades extra.",
               ("accounts.view_user", "accounts.add_user", "accounts.change_user", "auth.view_permission")),
    Capability("gestionar_roles", "Administración", "Gestionar roles",
               "Crear, editar y eliminar roles y elegir sus capacidades.",
               ("auth.view_group", "auth.add_group", "auth.change_group", "auth.delete_group",
                "auth.view_permission")),
    Capability("ver_auditoria", "Administración", "Ver auditoría",
               "Consultar el registro de auditoría.", ("audit.view_auditlog",)),
    Capability("verificar_auditoria", "Administración", "Verificar auditoría",
               "Comprobar que el registro de auditoría no fue alterado.",
               ("audit.view_auditlog", "audit.verify_auditlog")),
    Capability("publicar_terminos", "Administración", "Publicar términos y condiciones",
               "Publicar una nueva versión de los términos (todos deberán aceptarla).",
               ("legal.view_termsversion", "legal.add_termsversion")),
]

BY_CODE = {c.code: c for c in CAPABILITIES}
ALL_GRANTS = sorted({perm for c in CAPABILITIES for perm in c.grants})


def grants_for(codes) -> list[str]:
    """Permisos técnicos ("app.codename") de un conjunto de capacidades."""
    return sorted({perm for code in codes for perm in BY_CODE[code].grants})


def capabilities_from(perms) -> list[str]:
    """Capacidades completas contenidas en un conjunto de permisos técnicos."""
    owned = set(perms)
    return [c.code for c in CAPABILITIES if set(c.grants) <= owned]


def catalog() -> list[dict]:
    """Catálogo para la interfaz: cada capacidad con los ids de sus permisos técnicos."""
    from django.contrib.auth.models import Permission

    ids = {f"{p.content_type.app_label}.{p.codename}": p.id
           for p in Permission.objects.select_related("content_type")}
    return [
        {"code": c.code, "area": c.area, "label": c.label, "description": c.description,
         "permissions": [ids[g] for g in c.grants if g in ids], "grants": list(c.grants)}
        for c in CAPABILITIES
    ]
