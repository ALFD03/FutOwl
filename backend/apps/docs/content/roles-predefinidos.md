---
title: Roles predefinidos
summary: Para qué sirve cada rol que trae FutOwl y qué capacidades tiene quien lo recibe
section: permissions
order: 20
---
FutOwl crea estos roles con el comando `seed_roles` (`make roles`). Pueden modificarse desde **Administración → Roles y permisos**; el comando los restablece a estos valores.

> [!NOTE]
> «Consulta» son dos capacidades: *Consultar el registro* y *Consultar torneos y partidos*. Las tienen todos los roles operativos.

## Resumen

| Rol | Para quién | Capacidades |
|-----|-----------|-------------|
| **Administrador** | Responsable técnico de la plataforma | Todas. |
| **Autoridad** | Comisión organizadora / directiva del torneo | Todas, salvo *Gestionar usuarios* y *Gestionar roles*. |
| **Jefe de delegados** | Coordinador de delegados (también ejerce como delegado) | Lo del Delegado + *Gestionar delegados*, *Asignar delegados*, *Devolver informes*, *Ver usuarios*. |
| **Jefe de árbitros** | Coordinador arbitral (también ejerce como árbitro) | Lo del Árbitro + *Gestionar árbitros*, *Asignar árbitros*, *Devolver informes*, *Ver usuarios*. |
| **Delegado** | Responsable de mesa técnica | Consulta, *Confirmar asistencia*, *Mesa técnica de sus partidos*, *Informe del delegado*, *Notas y apelaciones*. |
| **Árbitro** | Árbitro principal o asistente | Consulta, *Confirmar asistencia*, *Informe arbitral*, *Notas y apelaciones*. |
| **Gestor de equipo** | Delegado o directivo del club | Lo del Entrenador + *Confirmar asistencia*, *Gestionar entrenadores*. |
| **Entrenador** | Director técnico con usuario | Consulta, *Gestionar plantilla*, *Gestionar nómina*, *Cargar alineaciones*, *Notas y apelaciones*. |

## Detalle por rol

### Administrador

Todas las capacidades: además de lo de la Autoridad, gestiona **usuarios** y **roles**. *No* edita la documentación salvo que además sea superusuario.

### Autoridad

- **Registro y Torneos completos**: categorías, canchas, cualquier equipo, plantilla, entrenadores, delegados, árbitros, torneos, inscripciones, grupos y nómina.
- **Programación**: fixture, jornadas (crear, programar cancha, horario y oficiales, enviar y cerrar), ajustes con exposición de motivos y suspensiones.
- **Partidos**: mesa técnica de **cualquier** partido, confirmar, notas; informes, devolverlos, **cerrar partidos** y **resolver revisiones**.
- **Administración**: ver usuarios, publicar términos, ver y verificar la auditoría.
- Recibe las notificaciones de rechazos, apelaciones e informes listos para cierre.

### Jefe de delegados

Ejerce como **delegado** (confirma sus asignaciones, opera la mesa técnica de sus partidos y envía su informe) y además:

- Registra y edita **delegados**.
- **Asigna el delegado** de cada partido en las jornadas en borrador y, si la jornada ya se envió (por ejemplo, tras un rechazo), lo reemplaza con exposición de motivos. **No** cambia cancha, horario ni jornada: eso lo programa la autoridad.
- Devuelve informes para corrección y ve los usuarios.

### Jefe de árbitros

Igual que el jefe de delegados, pero para árbitros: ejerce como **árbitro**, registra y edita árbitros, **asigna la terna arbitral** (y la reemplaza con exposición de motivos en jornadas enviadas), devuelve informes y ve los usuarios.

### Delegado

Confirma o rechaza sus asignaciones, opera la **mesa técnica** de los partidos donde es el delegado asignado, envía el **informe del delegado** y escribe notas y apelaciones en sus partidos.

### Árbitro

Confirma o rechaza sus asignaciones, envía el **informe arbitral** si es el árbitro principal y escribe notas y apelaciones en sus partidos.

### Gestor de equipo

Lo del entrenador más: **confirma la asistencia** del equipo y **gestiona entrenadores** (registrar, editar, asignar y liberar). Sus equipos aparecen **primero** y resaltados (*Mi equipo*) en **Equipos**, y su escudo junto a *Mi cuenta*. Todo limitado a **sus equipos**: puede consultar los demás equipos, pero solo modifica (crea, edita, activa o desactiva) lo de los suyos:

- Jugadores y entrenadores cuyo equipo actual es el suyo; los que están libres, solo si él mismo los registró. Puede **asignar** a su equipo un entrenador libre.
- Representantes de jugadores de su equipo (o registrados por él).
- Nómina y alineaciones de su equipo; notas y apelaciones solo en partidos donde juega su equipo.
- Al crear un entrenador puede **crear** su usuario de acceso, pero **vincular un usuario existente** es solo de administradores.

### Entrenador

Gestiona la **plantilla** y la **nómina** de su equipo, carga sus **alineaciones** y escribe notas y apelaciones en sus partidos, con las mismas reglas del gestor. Igual que el gestor, ve su equipo primero en **Equipos** y su escudo junto a *Mi cuenta*.

## Roles personalizados

Además de estos, puede crear roles a la medida (por ejemplo *Prensa* solo con consulta, o *Mesa técnica central* con *Mesa técnica de cualquier partido*). Vea [Crear roles y asignar capacidades](/app/ayuda/crear-roles-y-asignar-permisos).

```futowl-roles
```
