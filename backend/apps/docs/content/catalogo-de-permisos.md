---
title: Catálogo de permisos
summary: Qué hace cada permiso, dónde se usa y con qué roles viene
section: permissions
order: 30
---
Esta página explica **cada permiso** del sistema. Al final encontrará el **catálogo interactivo**: buscador, filtro por rol y la columna *Usted* que indica si su cuenta lo tiene.

> [!NOTE]
> **Editar** (`change_`) incluye también **desactivar y reactivar**. Los permisos **Eliminar** (`delete_`) de los registros maestros no tienen efecto porque en FutOwl esos registros no se borran.

## Registro (`registry`)

| Permiso | Código | Qué permite | Dónde |
|---------|--------|-------------|-------|
| Ver categorías | `registry.view_category` | Ver el menú y listado de categorías. | Registro → Categorías |
| Crear categorías | `registry.add_category` | Botón *Nueva categoría*. | |
| Editar categorías | `registry.change_category` | Editar, desactivar y reactivar. | |
| Ver canchas | `registry.view_field` | Ver el menú y listado de canchas. | Registro → Canchas |
| Crear canchas | `registry.add_field` | Botón *Nueva cancha*. | |
| Editar canchas | `registry.change_field` | Editar medidas, capacidad, responsable; desactivar. | |
| Ver entrenadores | `registry.view_coach` | Ver el menú y listado de entrenadores. | Registro → Entrenadores |
| Crear entrenadores | `registry.add_coach` | Registrar entrenadores (y su usuario). | |
| Editar entrenadores | `registry.change_coach` | Editar fichas; **asignar o liberar** entrenadores en *Cuerpo técnico* (gestores: solo entrenadores libres o de su equipo). | Ficha del equipo → Cuerpo técnico |
| Ver representantes | `registry.view_guardian` | Ver el menú y listado. | Registro → Representantes |
| Crear representantes | `registry.add_guardian` | Registrar representantes de menores. | |
| Editar representantes | `registry.change_guardian` | Editar y desactivar. | |
| Ver jugadores | `registry.view_player` | Ver el menú, listado, fichas y estadísticas. | Registro → Jugadores |
| Crear jugadores | `registry.add_player` | Crear jugadores (gestores: solo para sus equipos). Botón *Nuevo jugador* en la ficha del equipo. | |
| Editar jugadores | `registry.change_player` | Editar la ficha; solo el **equipo actual** del jugador o un administrador del registro. | |
| Ver delegados | `registry.view_delegate` | Ver el menú y listado. | Registro → Delegados |
| Crear delegados | `registry.add_delegate` | Registrar delegados (y su usuario). | |
| Editar delegados | `registry.change_delegate` | Editar, vincular usuario, desactivar. | |
| Ver árbitros | `registry.view_referee` | Ver el menú y listado. | Registro → Árbitros |
| Crear árbitros | `registry.add_referee` | Registrar árbitros (y su usuario). | |
| Editar árbitros | `registry.change_referee` | Editar, vincular usuario, desactivar. | |
| Ver equipos | `registry.view_team` | Ver el menú, listado y fichas de equipos; tarjeta *Equipos activos* del panel. | Registro → Equipos |
| Crear equipos | `registry.add_team` | Botón *Nuevo equipo*. | |
| Editar equipos | `registry.change_team` | **Administrador del registro**: editar cualquier equipo, sus **categorías** y su pestaña **Acceso**; gestionar plantilla, nómina y entrenadores de **cualquier** equipo; cambiar el equipo actual de un jugador. | Ficha del equipo |

Sin efecto, porque los registros maestros se desactivan en lugar de borrarse: `registry.delete_category`, `registry.delete_field`, `registry.delete_coach`, `registry.delete_guardian`, `registry.delete_player`, `registry.delete_delegate`, `registry.delete_referee`, `registry.delete_team`.

## Torneos (`tournaments`)

| Permiso | Código | Qué permite | Dónde |
|---------|--------|-------------|-------|
| Ver torneos | `tournaments.view_tournament` | Ver el menú, la ficha y sus pestañas; **exportar** documentos. | Competición → Torneos |
| Crear torneos | `tournaments.add_tournament` | Botón *Nuevo torneo*. | |
| Editar torneos | `tournaments.change_tournament` | Editar reglas, estado y fechas; guardar el **reglamento**; importar plantillas; gestionar la **nómina de cualquier equipo** del torneo; desactivar. | Ficha del torneo |
| Ver grupos | `tournaments.view_group` | Consultar grupos. | |
| Crear grupos | `tournaments.add_group` | Botón *+ Grupo*. | Torneo → Equipos y grupos |
| Editar grupos | `tournaments.change_group` | Renombrar o desactivar grupos. | |
| Ver equipos inscritos | `tournaments.view_tournamentteam` | Consultar inscripciones. | |
| Crear equipos inscritos | `tournaments.add_tournamentteam` | Botón *Inscribir equipo*. | Torneo → Equipos y grupos |
| Editar equipos inscritos | `tournaments.change_tournamentteam` | Asignar o cambiar el **grupo**; desactivar inscripciones. | |
| Ver nómina de jugadores | `tournaments.view_teamplayer` | Consultar nóminas. | Ficha del equipo |
| Crear nómina de jugadores | `tournaments.add_teamplayer` | *Inscribir jugador* / *Nuevo jugador* en la nómina (gestores: solo su equipo). | Ficha del equipo → Nómina por torneo |
| Editar nómina de jugadores | `tournaments.change_teamplayer` | Cambiar dorsal, **dar de baja** o reactivar inscripciones de la nómina. | |

Sin efecto (se desactiva en lugar de borrar): `tournaments.delete_tournament`, `tournaments.delete_group`, `tournaments.delete_tournamentteam`, `tournaments.delete_teamplayer`.

## Competición (`competition`)

### Jornadas

| Permiso | Código | Qué permite |
|---------|--------|-------------|
| Ver jornadas | `competition.view_matchday` | Menú **Jornadas** y su ficha. |
| Crear jornadas | `competition.add_matchday` | Botón *+ Jornada*. |
| Editar jornadas | `competition.change_matchday` | Cambiar número, día o nombre (por API). |
| Eliminar jornadas | `competition.delete_matchday` | Eliminar jornadas **en borrador** (papelera). |
| Enviar jornadas a confirmación | `competition.submit_matchday` | Botón **Enviar jornada**. |
| Cerrar jornadas | `competition.close_matchday` | Botón **Cerrar jornada**. |

### Partidos

| Permiso | Código | Qué permite |
|---------|--------|-------------|
| Ver partidos | `competition.view_match` | Menú **Partidos** y la ficha completa de cualquier partido (confirmaciones, alineaciones, cronología, informes, notas). |
| Crear partidos | `competition.add_match` | Botón *+ Partido* (partido manual). |
| Editar partidos | `competition.change_match` | **Programar** partidos en borrador: agregarlos o quitarlos de una jornada, cancha, horario, delegado y terna. |
| Eliminar partidos | `competition.delete_match` | Eliminar partidos **en borrador** (por API). |
| Generar el fixture | `competition.generate_fixture` | Botón **Generar fixture**. |
| Ajustar partidos confirmados… | `competition.adjust_match` | Botón **Ajustar** con exposición de motivos. |
| Suspender partidos | `competition.suspend_match` | Botón **Suspender**. |
| Confirmar o rechazar su asignación | `competition.confirm_assignment` | Botones **Confirmar / Rechazar** en la fila de **su** posición. |
| Operar la mesa técnica de sus partidos | `competition.operate_match` | Consola de **mesa técnica** de los partidos donde es **el delegado asignado**. |
| Operar la mesa técnica de cualquier partido | `competition.operate_any_match` | Consola de mesa técnica de **todos** los partidos y carga de alineaciones de **cualquier** equipo. |
| Cargar alineaciones de sus equipos | `competition.submit_lineup` | Cargar e importar la alineación de los equipos que gestiona o entrena. |
| Enviar el informe del delegado | `competition.submit_delegate_report` | Formulario de informe si es el delegado asignado. |
| Enviar el informe arbitral | `competition.submit_referee_report` | Formulario de informe si es el árbitro principal. |
| Devolver informes para corrección | `competition.return_report` | Botón **Devolver** en un informe. |
| Cerrar partidos | `competition.close_match` | Botón **Cerrar partido** y notificación «Informes listos para cierre». |
| Programar partidos (cancha, horario, oficiales) | `competition.schedule_match` | **Reservado**: hoy no habilita acciones por sí solo; la programación usa `competition.change_match`. |
| Verificar documentación/alineaciones en mesa técnica | `competition.verify_lineup` | **Reservado**: la verificación se registra desde la mesa técnica, que exige `operate_match` u `operate_any_match`. |

### Revisiones y notas

| Permiso | Código | Qué permite |
|---------|--------|-------------|
| Ver casos en revisión | `competition.view_reviewcase` | Menú **Revisiones** y tarjeta *Revisiones abiertas* del panel. |
| Resolver casos en revisión | `competition.resolve_reviewcase` | Botones **Resolver / Desestimar**; recibe avisos de rechazos y apelaciones. |
| Crear notas y apelaciones | `competition.add_matchnote` | Formulario *Nueva entrada* en **Notas y apelaciones**. |
| Ver / editar / eliminar notas y apelaciones | `competition.view_matchnote`, `competition.change_matchnote`, `competition.delete_matchnote` | Sin efecto: las notas se consultan con *Ver partidos* y nunca se modifican ni borran. |
| Crear / editar / eliminar casos en revisión | `competition.add_reviewcase`, `competition.change_reviewcase`, `competition.delete_reviewcase` | Sin efecto: los casos se crean solos (rechazos y apelaciones) y solo se cierran con *Resolver casos en revisión*. |

### Registros internos del partido

Los permisos de **alineaciones, jugadores en alineación, eventos de partido, confirmaciones de asistencia, ajustes, informes, devoluciones de informes y cierres de partidos** existen porque son tablas del sistema, pero **no habilitan acciones por sí solos**: esas operaciones se controlan con los permisos de partido de la tabla anterior y con el permiso *Ver partidos* para consultarlas. Las tablas de solo inserción no pueden editarse ni eliminarse con ningún permiso.

## Usuarios y roles (`accounts`, `auth`)

| Permiso | Código | Qué permite |
|---------|--------|-------------|
| Ver usuarios | `accounts.view_user` | Menú **Usuarios** y listado. |
| Crear usuarios | `accounts.add_user` | Botón *Nuevo usuario*. |
| Editar usuarios | `accounts.change_user` | Editar datos, contraseña, **roles y permisos personalizados**; desactivar; **desbloquear**. |
| Eliminar usuarios | `accounts.delete_user` | Sin efecto: los usuarios se desactivan. |
| Ver roles | `auth.view_group` | Menú **Roles y permisos**. |
| Crear roles | `auth.add_group` | Botón *Nuevo rol*. |
| Editar roles | `auth.change_group` | Cambiar nombre y permisos de un rol. |
| Eliminar roles | `auth.delete_group` | Sin uso en la interfaz. |

> [!IMPORTANT]
> Para mostrar el selector de permisos al editar usuarios o roles, la cuenta debe poder consultar el catálogo de permisos (`auth.view_permission`). Ese permiso no aparece en el selector; lo tienen el rol **Administrador** y el superusuario.

## Auditoría (`audit`)

| Permiso | Código | Qué permite |
|---------|--------|-------------|
| Ver registros de auditoría | `audit.view_auditlog` | Menú **Auditoría** y detalle de cada asiento. |
| Verificar la integridad de la bitácora | `audit.verify_auditlog` | Botón **Verificar integridad**. |

## Términos y condiciones (`legal`)

| Permiso | Código | Qué permite |
|---------|--------|-------------|
| Crear versiones de términos | `legal.add_termsversion` | Menú **Términos** y publicar nuevas versiones. |
| Demás permisos de términos y aceptaciones | `legal.view_*`, `legal.change_*`, `legal.delete_*` | Sin efecto: los términos vigentes son públicos y las versiones y aceptaciones no se modifican. |

## Notificaciones (`notifications`)

Los permisos de notificaciones no tienen efecto: **cada usuario ve siempre las suyas** y nadie puede leer las de otros.

## Documentación

Editar esta documentación **no** depende de ningún permiso: es exclusivo del **superusuario**. Leerla está permitido a cualquier usuario con sesión.

## Catálogo interactivo

```futowl-permisos
```
