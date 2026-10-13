---
title: Catálogo de capacidades
summary: Qué permite cada capacidad, con qué roles viene y qué permisos técnicos activa
section: permissions
order: 30
---
Las **capacidades** son lo que se asigna a roles y usuarios: cada una es una función concreta del sistema. Esta página explica todas; al final está el **catálogo interactivo**, con buscador, filtro por rol y la columna *Usted* que indica si su cuenta la tiene.

> [!NOTE]
> «Editar» incluye **desactivar y reactivar**. Lo que está en **borrador** (torneos, jornadas y partidos) se puede eliminar definitivamente; una vez enviado o confirmado ya no se borra.


## Consulta

| Capacidad | Qué permite | Roles que la traen |
|-----------|-------------|--------------------|
| **Consultar el registro** | Ver categorías, canchas, equipos, jugadores, representantes, entrenadores, delegados y árbitros. | Administrador, Autoridad, Delegado, Árbitro, Jefe de delegados, Jefe de árbitros, Entrenador, Gestor de equipo |
| **Consultar torneos y partidos** | Ver torneos, reglas, inscripciones, nóminas, jornadas, la ficha completa de los partidos (confirmaciones, alineaciones, cronología, informes y notas) y las revisiones. | Administrador, Autoridad, Delegado, Árbitro, Jefe de delegados, Jefe de árbitros, Entrenador, Gestor de equipo |

## Registro

| Capacidad | Qué permite | Roles que la traen |
|-----------|-------------|--------------------|
| **Gestionar categorías** | Crear, editar y activar o desactivar categorías. | Administrador, Autoridad |
| **Gestionar canchas** | Crear, editar y activar o desactivar canchas. | Administrador, Autoridad |
| **Administrar todos los equipos** | Crear clubes y editar cualquier equipo: datos, categorías, usuarios de acceso, plantilla, cuerpo técnico y nómina. Sin esta capacidad, cada gestor o entrenador solo maneja lo de su equipo. | Administrador, Autoridad |
| **Gestionar plantilla** | Registrar y editar jugadores y sus representantes (de sus equipos, salvo que administre todos). | Administrador, Autoridad, Entrenador, Gestor de equipo |
| **Gestionar entrenadores** | Registrar, editar, asignar y liberar entrenadores (de sus equipos, salvo que administre todos). | Administrador, Autoridad, Gestor de equipo |
| **Gestionar delegados** | Registrar, editar y activar o desactivar delegados. | Administrador, Autoridad, Jefe de delegados |
| **Gestionar árbitros** | Registrar, editar y activar o desactivar árbitros. | Administrador, Autoridad, Jefe de árbitros |

## Torneos

| Capacidad | Qué permite | Roles que la traen |
|-----------|-------------|--------------------|
| **Gestionar torneos** | Crear torneos; editar sus datos, estado, puntuación, ajustes de reglas por categoría, reglamento y documentos; y eliminar definitivamente los que siguen en borrador. | Administrador, Autoridad |
| **Inscripciones y grupos** | Inscribir equipos en los torneos por categoría y armar los grupos. | Administrador, Autoridad |
| **Gestionar nómina** | Inscribir jugadores en la nómina de un torneo, cambiar dorsales y dar de baja (de sus equipos, salvo que administre todos los equipos o gestione torneos). | Administrador, Autoridad, Entrenador, Gestor de equipo |

## Programación

| Capacidad | Qué permite | Roles que la traen |
|-----------|-------------|--------------------|
| **Armar el fixture** | Generar el fixture automáticamente y crear o eliminar partidos en borrador. | Administrador, Autoridad |
| **Programar jornadas y partidos** | Crear y eliminar jornadas en borrador, agregar o quitar partidos y asignar cancha, horario, delegado y terna arbitral. | Administrador, Autoridad |
| **Asignar delegados** | Elegir el delegado de cada partido en las jornadas en borrador y, ya enviada la jornada, reemplazarlo con exposición de motivos. No cambia cancha ni horario. | Administrador, Autoridad, Jefe de delegados |
| **Asignar árbitros** | Elegir la terna arbitral de cada partido en las jornadas en borrador y, ya enviada la jornada, reemplazarla con exposición de motivos. No cambia cancha ni horario. | Administrador, Autoridad, Jefe de árbitros |
| **Enviar jornadas a confirmación** | Bloquear una jornada completa y pedir la confirmación de oficiales y equipos. | Administrador, Autoridad |
| **Cerrar jornadas** | Cerrar una jornada cuando terminó. | Administrador, Autoridad |
| **Ajustar partidos confirmados** | Cambiar cancha, horario u oficiales de un partido ya enviado, con exposición de motivos. Las partes afectadas vuelven a confirmar. | Administrador, Autoridad |
| **Suspender partidos** | Suspender un partido indicando el motivo. | Administrador, Autoridad |

## Día de partido

| Capacidad | Qué permite | Roles que la traen |
|-----------|-------------|--------------------|
| **Confirmar asistencia** | Confirmar o rechazar su asignación a un partido (como oficial o por su equipo). | Administrador, Autoridad, Delegado, Árbitro, Jefe de delegados, Jefe de árbitros, Gestor de equipo |
| **Cargar alineaciones** | Cargar o importar la alineación de sus equipos. | Administrador, Autoridad, Entrenador, Gestor de equipo |
| **Mesa técnica de sus partidos** | Operar la consola de mesa técnica de los partidos donde es el delegado asignado. | Administrador, Autoridad, Delegado, Jefe de delegados |
| **Mesa técnica de cualquier partido** | Operar la mesa técnica de todos los partidos y cargar la alineación de cualquier equipo. | Administrador, Autoridad |
| **Notas y apelaciones** | Escribir notas y apelaciones en los partidos donde participa (oficial o equipo). | Administrador, Autoridad, Delegado, Árbitro, Jefe de delegados, Jefe de árbitros, Entrenador, Gestor de equipo |

## Informes y cierre

| Capacidad | Qué permite | Roles que la traen |
|-----------|-------------|--------------------|
| **Informe del delegado** | Enviar el informe del partido como delegado asignado. | Administrador, Autoridad, Delegado, Jefe de delegados |
| **Informe arbitral** | Enviar el informe del partido como árbitro principal. | Administrador, Autoridad, Árbitro, Jefe de árbitros |
| **Devolver informes** | Devolver un informe para que su autor lo corrija. | Administrador, Autoridad, Jefe de delegados, Jefe de árbitros |
| **Cerrar partidos** | Cierre oficial del partido con los informes recibidos. | Administrador, Autoridad |
| **Resolver revisiones** | Resolver o desestimar rechazos de asignación y apelaciones; recibe sus avisos. | Administrador, Autoridad |

## Administración

| Capacidad | Qué permite | Roles que la traen |
|-----------|-------------|--------------------|
| **Ver usuarios** | Consultar los usuarios. | Administrador, Autoridad, Jefe de delegados, Jefe de árbitros |
| **Gestionar usuarios** | Crear y editar usuarios, sus roles y capacidades extra. | Administrador |
| **Gestionar roles** | Crear, editar y eliminar roles y elegir sus capacidades. | Administrador |
| **Ver auditoría** | Consultar el registro de auditoría. | Administrador, Autoridad |
| **Verificar auditoría** | Comprobar que el registro de auditoría no fue alterado. | Administrador, Autoridad |
| **Publicar términos y condiciones** | Publicar una nueva versión de los términos (todos deberán aceptarla). | Administrador, Autoridad |

## Permisos técnicos

Por dentro, cada capacidad activa uno o varios permisos técnicos de Django (por ejemplo, *Gestionar canchas* activa `registry.add_field` y `registry.change_field`). Los permisos técnicos que no forman parte de ninguna capacidad **no habilitan nada por sí solos** y no se asignan.

| Capacidad | Permisos técnicos que activa |
|-----------|------------------------------|
| Consultar el registro | `registry.view_category`, `registry.view_field`, `registry.view_team`, `registry.view_player`, `registry.view_guardian`, `registry.view_coach`, `registry.view_delegate`, `registry.view_referee` |
| Consultar torneos y partidos | `tournaments.view_tournament`, `tournaments.view_categoryrules`, `tournaments.view_group`, `tournaments.view_tournamentteam`, `tournaments.view_teamplayer`, `competition.view_matchday`, `competition.view_match`, `competition.view_reviewcase` |
| Gestionar categorías | `registry.add_category`, `registry.change_category` |
| Gestionar canchas | `registry.add_field`, `registry.change_field` |
| Administrar todos los equipos | `registry.add_team`, `registry.change_team` |
| Gestionar plantilla | `registry.add_player`, `registry.change_player`, `registry.add_guardian`, `registry.change_guardian` |
| Gestionar entrenadores | `registry.add_coach`, `registry.change_coach` |
| Gestionar delegados | `registry.add_delegate`, `registry.change_delegate` |
| Gestionar árbitros | `registry.add_referee`, `registry.change_referee` |
| Gestionar torneos | `tournaments.add_tournament`, `tournaments.change_tournament`, `tournaments.add_categoryrules`, `tournaments.change_categoryrules`, `tournaments.delete_tournament` |
| Inscripciones y grupos | `tournaments.add_tournamentteam`, `tournaments.change_tournamentteam`, `tournaments.add_group`, `tournaments.change_group` |
| Gestionar nómina | `tournaments.add_teamplayer`, `tournaments.change_teamplayer` |
| Armar el fixture | `competition.generate_fixture`, `competition.add_match`, `competition.delete_match` |
| Programar jornadas y partidos | `competition.add_matchday`, `competition.change_matchday`, `competition.delete_matchday`, `competition.change_match` |
| Asignar delegados | `competition.assign_delegate` |
| Asignar árbitros | `competition.assign_referees` |
| Enviar jornadas a confirmación | `competition.submit_matchday` |
| Cerrar jornadas | `competition.close_matchday` |
| Ajustar partidos confirmados | `competition.adjust_match` |
| Suspender partidos | `competition.suspend_match` |
| Confirmar asistencia | `competition.confirm_assignment` |
| Cargar alineaciones | `competition.submit_lineup` |
| Mesa técnica de sus partidos | `competition.operate_match` |
| Mesa técnica de cualquier partido | `competition.operate_any_match` |
| Notas y apelaciones | `competition.add_matchnote` |
| Informe del delegado | `competition.submit_delegate_report` |
| Informe arbitral | `competition.submit_referee_report` |
| Devolver informes | `competition.return_report` |
| Cerrar partidos | `competition.close_match` |
| Resolver revisiones | `competition.resolve_reviewcase` |
| Ver usuarios | `accounts.view_user` |
| Gestionar usuarios | `accounts.view_user`, `accounts.add_user`, `accounts.change_user`, `auth.view_permission` |
| Gestionar roles | `auth.view_group`, `auth.add_group`, `auth.change_group`, `auth.delete_group`, `auth.view_permission` |
| Ver auditoría | `audit.view_auditlog` |
| Verificar auditoría | `audit.view_auditlog`, `audit.verify_auditlog` |
| Publicar términos y condiciones | `legal.view_termsversion`, `legal.add_termsversion` |

## Documentación

Editar esta documentación **no** depende de ninguna capacidad: es exclusivo del **superusuario**. Leerla está permitido a cualquier usuario con sesión.

## Catálogo interactivo

```futowl-permisos
```
