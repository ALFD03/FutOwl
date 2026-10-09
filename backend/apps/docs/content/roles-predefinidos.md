---
title: Roles predefinidos
summary: Para qué sirve cada rol que trae FutOwl y qué puede hacer quien lo tiene
section: permissions
order: 20
---
FutOwl crea estos roles con el comando `seed_roles`. Pueden modificarse desde **Administración → Roles y permisos**; el comando los restablece a estos valores.

> [!NOTE]
> «Consulta general» significa **ver** todo lo de Registro, Torneos, Competición, Notificaciones y Términos (`registry.view_*`, `tournaments.view_*`, `competition.view_*`, `notifications.view_*`, `legal.view_*`). Ningún rol, salvo Administrador, puede **eliminar** registros.

## Resumen

| Rol | Para quién | Permisos clave |
|-----|-----------|----------------|
| **Administrador** | Responsable técnico de la plataforma | Todos los permisos. |
| **Autoridad** | Comisión organizadora / directiva del torneo | Todo Registro, Torneos, Competición y Términos; ver y verificar auditoría; ver usuarios. |
| **Jefe de delegados** | Coordinador de delegados | Consulta general; crear/editar delegados; devolver informes; ver usuarios. |
| **Jefe de árbitros** | Coordinador arbitral | Consulta general; crear/editar árbitros; devolver informes; ver usuarios. |
| **Delegado** | Responsable de mesa técnica | Consulta general; confirmar asignación; operar mesa técnica; informe del delegado; notas. |
| **Árbitro** | Árbitro principal o asistente | Consulta general; confirmar asignación; informe arbitral; notas. |
| **Gestor de equipo** | Delegado o directivo del club | Consulta general; plantilla y nómina; entrenadores; alineaciones; confirmar asistencia; notas. |
| **Entrenador** | Director técnico con usuario | Consulta general; plantilla y nómina; alineaciones; notas. |

## Detalle por rol

### Administrador

Todos los permisos del catálogo (incluido eliminar y consultar el catálogo de permisos al editar usuarios y roles). Gestiona usuarios, roles, términos y auditoría. *No* edita la documentación salvo que además sea superusuario.

### Autoridad

- **Registro, Torneos y Competición completos**: crear y editar todo; inscripciones, grupos y nómina de cualquier equipo; fixture; jornadas (crear, programar, enviar, cerrar); ajustes, suspensiones; devolver informes y **cerrar partidos**; **resolver revisiones**; operar la mesa técnica de **cualquier** partido (`operate_any_match`).
- **Términos**: publicar nuevas versiones.
- **Auditoría**: consultar y verificar integridad.
- **Usuarios**: solo ver.
- Recibe las notificaciones de rechazos, apelaciones e informes listos para cierre.

### Jefe de delegados

Consulta general; `registry.add_delegate`, `registry.change_delegate`; `competition.return_report`; `competition.add_matchnote`; `accounts.view_user`. También trae `competition.schedule_match` y `competition.verify_lineup`, que hoy no habilitan acciones por sí solos (vea el [catálogo](/app/ayuda/catalogo-de-permisos)). Para programar partidos agregue `competition.change_match`.

### Jefe de árbitros

Igual que el jefe de delegados pero para árbitros: `registry.add_referee`, `registry.change_referee`, `competition.return_report`, `competition.add_matchnote`, `accounts.view_user` y `competition.schedule_match`.

### Delegado

Consulta general más `competition.confirm_assignment`, `competition.operate_match` (solo sus partidos), `competition.submit_delegate_report`, `competition.add_matchnote` y `competition.verify_lineup`.

### Árbitro

Consulta general más `competition.confirm_assignment`, `competition.submit_referee_report` (solo como árbitro principal) y `competition.add_matchnote`.

### Gestor de equipo

Consulta general más:

- Plantilla: `registry.add_player`, `registry.change_player`, `registry.add_guardian`, `registry.change_guardian`.
- Nómina: `tournaments.add_teamplayer`, `tournaments.change_teamplayer`.
- Cuerpo técnico: `registry.add_coach`, `registry.change_coach`.
- Partido: `competition.confirm_assignment` (asistencia del equipo), `competition.submit_lineup`, `competition.add_matchnote`.

Todo limitado a **sus equipos**.

### Entrenador

Igual que el gestor en plantilla, nómina, alineaciones y notas, **sin** confirmar asistencia ni gestionar entrenadores. Limitado al equipo al que pertenece.

## Roles personalizados

Además de estos, puede crear roles a la medida (por ejemplo *Prensa* solo con consulta, o *Mesa técnica central* con `operate_any_match`). Vea [Crear roles y asignar permisos](/app/ayuda/crear-roles-y-asignar-permisos).

```futowl-roles
```
