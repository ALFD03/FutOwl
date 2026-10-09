---
title: Entrenadores
summary: Cuerpo técnico, licencias, equipo asignado y usuario de acceso
section: manual
order: 100
---
**Ruta:** Registro → Entrenadores (`/app/entrenadores`) · **Permisos:** `registry.view_coach`, `registry.add_coach`, `registry.change_coach`.

## Campos

| Sección | Campo | Notas |
|---------|-------|-------|
| Persona | Nombres, apellidos, **cédula**, teléfono, foto, foto de la cédula | Cédula y teléfono cifrados. |
| Licencia | **N.º de licencia**, **año de vencimiento**, foto de la licencia | La licencia se muestra *Vigente* si el año de vencimiento es el actual o posterior; si no, *Vencida*. |
| Usuario de acceso | *Sin usuario*, *Vincular existente* o *Crear usuario* | El usuario recibe el rol **Entrenador**. |

## Equipo del entrenador

- Un entrenador pertenece a **un solo equipo a la vez** (o está *Libre*).
- Se asigna desde la ficha del equipo → pestaña **Cuerpo técnico**.
- No puede pasar a otro equipo si ambos equipos participan en un mismo torneo que no ha finalizado (no puede dirigir a dos equipos del mismo torneo).
- Un gestor solo puede asignar entrenadores **libres** a su equipo o liberar los de su equipo.

## Para qué sirve el usuario del entrenador

Con usuario vinculado y rol *Entrenador*, el entrenador **ayuda al gestor**:

- Ve los partidos de su equipo en **Mis asignaciones**.
- Puede crear jugadores e inscribirlos en la nómina de su equipo.
- Carga e importa **alineaciones** de su equipo.
- Puede dejar **notas o apelaciones**.

> [!NOTE]
> La **confirmación de asistencia del equipo** la hacen los **gestores** del equipo, no el entrenador.

## En la alineación

Al cargar la alineación se elige el **entrenador en banco** entre los entrenadores activos del equipo. Su nombre y licencia aparecen en la planilla exportada.
