---
title: API REST
summary: Autenticación, convenciones y endpoints principales con ejemplos
section: reference
order: 30
---
Toda la funcionalidad del panel está disponible en la API bajo `/api/`. Las mismas reglas de permisos, estados y auditoría aplican a la API y a la interfaz.

## Autenticación

1. `POST /api/auth/login/` con `{"username": "...", "password": "..."}`. Responde `{"access": "<token>", "user": {...}}` y deja la cookie de renovación (httpOnly).
2. Envíe el token en cada petición: `Authorization: Bearer <token>`.
3. El token dura 15 minutos; renuévelo con `POST /api/auth/refresh/` (usa la cookie).
4. `POST /api/auth/logout/` invalida la sesión.

```bash
curl -X POST https://<dominio>/api/auth/login/ \
  -H "Content-Type: application/json" \
  -d '{"username":"autoridad","password":"********"}'

curl https://<dominio>/api/matches/?tournament=3&status=confirmed \
  -H "Authorization: Bearer <token>"
```

> [!NOTE]
> Además del permiso de cada acción, la API exige haber aceptado los términos vigentes (`POST /api/legal/terms/accept/`).

## Convenciones

- Listados paginados: `?page=2&page_size=50` → `{"count", "next", "previous", "results"}`.
- Búsqueda: `?search=texto`; orden: `?ordering=-scheduled_start`; filtros por campo: `?status=pending`.
- Crear `POST`, editar `PATCH`; activar/desactivar: `POST …/<id>/activate/` y `…/<id>/deactivate/`.
- Errores de validación: `400` con `{"campo": ["mensaje"]}`; sin permiso: `403`; sin sesión: `401`; cuenta bloqueada: `423`.

## Endpoints

| Área | Rutas |
|------|-------|
| Cuenta | `auth/login/`, `auth/refresh/`, `auth/logout/`, `auth/me/`, `auth/change-password/` |
| Términos | `legal/terms/current/`, `legal/terms/accept/`, `legal/terms/publish/` |
| Registro | `categories/`, `fields/`, `coaches/`, `guardians/`, `players/` (`?available_for=<inscripción>`, `?team=`), `delegates/`, `referees/`, `teams/` (`?mine=1`) |
| Torneos | `tournaments/` (+ `documents/lineup-sheet/`, `documents/substitution-cards/`, `documents/regulation/` con `format_type=pdf\|docx`), `groups/`, `registrations/`, `roster/` |
| Jornadas | `matchdays/` (+ `<id>/completeness/`, `<id>/submit/`, `<id>/close/`) |
| Partidos | `matches/` (`?mine=1`, `?unscheduled=1`, `?date=`) + `generate-fixture/`, `<id>/confirmations/`, `respond/`, `adjust/`, `adjustments/`, `suspend/`, `lineups/`, `submit-lineup/`, `import-lineup/`, `events/`, `record-event/`, `state/`, `reports/`, `submit-report/`, `return-report/`, `close/`, `notes/`, `add-note/` |
| Revisiones y posiciones | `review-cases/` (+ `<id>/resolve/`), `standings/?tournament=&category=&group=&live=1` |
| Administración | `users/` (+ `<id>/unlock/`), `roles/`, `permissions/`, `audit-logs/` (+ `verify/`) |
| Notificaciones | `notifications/` (`?unread=1`), `unread_count/`, `<id>/read/`, `read_all/` |
| Documentación | `docs/` (`?search=`, `?section=`), `docs/<slug>/`, `docs/<slug>/revisions/`, `docs/permission-catalog/` |
| Público (sin sesión) | `public/tournaments/`, `public/tournaments/<id>/` (+ `standings/`, `stats/`, `matches/`), `public/matches/live/`, `public/matches/<id>/` |
| Utilidades | `time/`, `health/` |

## Ejemplos

### Responder una asignación

```http
POST /api/matches/41/respond/
{"party": "referee", "response": "rejected", "reason": "Viaje de trabajo ese fin de semana"}
```

`party` es `delegate`, `referee`, `assistant_1`, `assistant_2`, `home` o `away`.

### Registrar un gol en la mesa técnica

```http
POST /api/matches/41/record-event/
{"type": "goal", "team": 87, "player": 1520, "minute": 23}
```

`team` es la **inscripción** del equipo en el torneo y `player` la entrada de **nómina**. Tipos: `delegate_arrival`, `team_arrival`, `documents_verified`, `kickoff`, `period_start`, `goal`, `penalty_goal`, `own_goal`, `yellow_card`, `red_card`, `substitution` (con `player_in`), `incident`, `note`, `period_end`, `match_end`, `annulment` (con `annuls` y `notes`).

### Ajustar un partido

```http
POST /api/matches/41/adjust/
{"referee": 12, "reason": "Reemplazo por rechazo justificado del árbitro asignado"}
```

### Límites

- Inicio de sesión: 5 intentos por minuto por IP.
- Peticiones: 120/min sin sesión y 600/min con sesión.
