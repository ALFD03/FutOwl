"""
Roles (grupos) predefinidos de FutOwl. Pueden ampliarse desde la interfaz de
administración de roles o asignarse permisos personalizados a cada usuario.
"""

ADMIN = "Administrador"
AUTHORITY = "Autoridad"
DELEGATE = "Delegado"
REFEREE = "Árbitro"
TEAM_MANAGER = "Gestor de equipo"
VIEWER = "Consulta"

DOMAIN_APPS = ["registry", "tournaments", "competition", "notifications", "legal"]

# Permisos de lectura comunes para cualquier rol operativo
VIEW_DOMAIN = [f"{app}.view_*" for app in DOMAIN_APPS]

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
    TEAM_MANAGER: VIEW_DOMAIN
    + [
        "competition.confirm_assignment",
        "competition.submit_lineup",
        "competition.add_matchnote",
        "registry.add_player",
        "registry.change_player",
        "registry.add_guardian",
        "registry.change_guardian",
        "registry.add_coach",
        "registry.change_coach",
        "registry.add_teamplayer",
        "registry.change_teamplayer",
    ],
    VIEWER: VIEW_DOMAIN,
}
