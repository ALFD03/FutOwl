"""
Roles (grupos) predefinidos de FutOwl. Pueden ampliarse desde la interfaz de
administración de roles o asignarse permisos personalizados a cada usuario.
"""

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

DOMAIN_APPS = ["registry", "tournaments", "competition", "notifications", "legal"]

# Permisos de lectura comunes para cualquier rol operativo
VIEW_DOMAIN = [f"{app}.view_*" for app in DOMAIN_APPS]

# Plantilla del equipo: jugadores, representantes y nómina por torneo
SQUAD = [
    "registry.add_player",
    "registry.change_player",
    "registry.add_guardian",
    "registry.change_guardian",
    "tournaments.add_teamplayer",
    "tournaments.change_teamplayer",
]

ROLE_PERMISSIONS: dict[str, list[str]] = {
    ADMIN: ["*"],
    AUTHORITY: [
        "registry.*",
        "tournaments.*",
        "competition.*",
        "legal.*",
        "notifications.view_*",
        "audit.view_auditlog",
        "audit.verify_auditlog",
        "accounts.view_user",
    ],
    DELEGATE: VIEW_DOMAIN
    + [
        "competition.confirm_assignment",
        "competition.operate_match",
        "competition.submit_delegate_report",
        "competition.add_matchnote",
        "competition.verify_lineup",
    ],
    REFEREE: VIEW_DOMAIN
    + [
        "competition.confirm_assignment",
        "competition.submit_referee_report",
        "competition.add_matchnote",
    ],
    HEAD_DELEGATE: VIEW_DOMAIN
    + [
        "registry.add_delegate",
        "registry.change_delegate",
        "competition.schedule_match",
        "competition.return_report",
        "competition.verify_lineup",
        "competition.add_matchnote",
        "accounts.view_user",
    ],
    HEAD_REFEREE: VIEW_DOMAIN
    + [
        "registry.add_referee",
        "registry.change_referee",
        "competition.schedule_match",
        "competition.return_report",
        "competition.add_matchnote",
        "accounts.view_user",
    ],
    COACH: VIEW_DOMAIN
    + SQUAD
    + [
        "competition.submit_lineup",
        "competition.add_matchnote",
    ],
    TEAM_MANAGER: VIEW_DOMAIN
    + SQUAD
    + [
        "competition.confirm_assignment",
        "competition.submit_lineup",
        "competition.add_matchnote",
        "registry.add_coach",
        "registry.change_coach",
    ],
}
