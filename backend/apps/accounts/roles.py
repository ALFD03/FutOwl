"""
Roles (grupos) predefinidos de FutOwl, expresados en capacidades (ver `capabilities.py`).
Pueden ampliarse desde la administración de roles o con capacidades extra por usuario.
"""
from .capabilities import CAPABILITIES, grants_for

ADMIN = "Administrador"
AUTHORITY = "Autoridad"
DELEGATE = "Delegado"
REFEREE = "Árbitro"
HEAD_DELEGATE = "Jefe de delegados"
HEAD_REFEREE = "Jefe de árbitros"
COACH = "Entrenador"
TEAM_MANAGER = "Gestor de equipo"

# Roles que existieron en versiones anteriores y ya no se crean por defecto.
RETIRED_ROLES = ["Consulta"]

CONSULTA = ["ver_registro", "ver_competicion"]
DELEGATE_DUTIES = ["confirmar_asistencia", "mesa_tecnica", "informe_delegado", "notas"]
REFEREE_DUTIES = ["confirmar_asistencia", "informe_arbitral", "notas"]
SQUAD = ["gestionar_plantilla", "gestionar_nomina", "cargar_alineaciones", "notas"]

ROLE_CAPABILITIES: dict[str, list[str]] = {
    ADMIN: [c.code for c in CAPABILITIES],
    # Todo lo operativo; usuarios y roles quedan para el Administrador.
    AUTHORITY: [c.code for c in CAPABILITIES if c.code not in ("gestionar_usuarios", "gestionar_roles")],
    DELEGATE: CONSULTA + DELEGATE_DUTIES,
    REFEREE: CONSULTA + REFEREE_DUTIES,
    # Los jefes también ejercen como delegado / árbitro y asignan a los oficiales de su tipo (no programan).
    HEAD_DELEGATE: CONSULTA + DELEGATE_DUTIES + ["gestionar_delegados", "asignar_delegados", "devolver_informes",
                                                 "ver_usuarios"],
    HEAD_REFEREE: CONSULTA + REFEREE_DUTIES + ["gestionar_arbitros", "asignar_arbitros", "devolver_informes",
                                               "ver_usuarios"],
    COACH: CONSULTA + SQUAD,
    TEAM_MANAGER: CONSULTA + SQUAD + ["confirmar_asistencia", "gestionar_entrenadores"],
}

# Permisos técnicos que recibe cada rol. El Administrador recibe todos ("*").
ROLE_PERMISSIONS: dict[str, list[str]] = {
    role: ["*"] if role == ADMIN else grants_for(codes) for role, codes in ROLE_CAPABILITIES.items()
}
