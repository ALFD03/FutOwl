---
title: Jornadas
summary: Armar el día de competencia, validaciones de solapamiento, enviar y cerrar la jornada
section: manual
order: 150
---
**Rutas:** Competición → Jornadas (`/app/jornadas`) o la pestaña *Jornadas* del torneo · **Permisos:** `competition.view_matchday` (ver), `competition.add_matchday` (crear), `competition.change_match` (programar partidos), `competition.submit_matchday` (enviar), `competition.close_matchday` (cerrar), `competition.delete_matchday` (eliminar borrador).

## Ciclo de vida

| Estado | Significado |
|--------|-------------|
| **Borrador** | Se está armando. Partidos editables. |
| **Enviada (pendiente de confirmaciones)** | Asignaciones bloqueadas; esperando a los oficiales. |
| **Válida (confirmada)** | Todos los partidos confirmados. Pasa sola a este estado. |
| **Cerrada** | Todos los partidos cerrados o suspendidos; solo notas o apelaciones. |

El listado permite filtrar por estado.

## 1. Crear la jornada

Botón **+ Jornada**: torneo (si se crea desde el menú general), **número** (único dentro del torneo), **día** y nombre opcional (*Jornada 1 · Apertura*). Queda en **Borrador** y se abre su ficha.

## 2. Agregar partidos

**Agregar partidos** muestra los partidos del torneo en **Borrador** que aún **no tienen jornada**. Marque los que se jugarán ese día y pulse **Agregar**. Para sacar un partido de la jornada use la **X** de su tarjeta.

## 3. Programar cada partido

En cada tarjeta complete:

| Campo | Notas |
|-------|-------|
| **Cancha** | El selector muestra la capacidad de cada cancha. |
| **Inicio** | Fecha y hora (UTC-4). Debe ser **el mismo día de la jornada**. La **hora de fin** se calcula sola. |
| **Delegado** | Obligatorio. |
| **Árbitro principal** | Obligatorio. |
| **Asistente 1 / Asistente 2** | Solo aparecen si el torneo los exige. |

Pulse **Guardar** en la tarjeta. FutOwl valida al instante:

- **Capacidad de la cancha** y **mini cancha** libre (la asigna sola si la cancha es divisible).
- Que el **delegado** no tenga otro partido a la misma hora.
- Que ningún **árbitro** tenga otro partido a la misma hora (en ninguna posición) y que no repita posición en la terna.
- Que **ninguno de los equipos** juegue otro partido a la misma hora.

El error aparece debajo del campo correspondiente. Cada tarjeta indica **Completo** o **Falta: …**.

> [!TIP]
> Un aviso arriba indica si la jornada está completa. Mientras falte algún dato en algún partido, el botón **Enviar jornada** permanece deshabilitado.

## 4. Enviar la jornada

**Enviar jornada** (con confirmación). FutOwl vuelve a validar todos los solapamientos y que cada partido sea del día de la jornada. Si todo está bien:

- Cada partido pasa a **Pendiente de confirmación** y su asignación queda **bloqueada** (versión 1).
- Se **notifica** a delegado, árbitros y gestores de ambos equipos con fecha, hora y cancha.
- La jornada pasa a **Enviada**.

A partir de aquí, cualquier cambio de cancha, horario u oficiales se hace con un **ajuste** desde la ficha del partido. Vea [Confirmaciones y ajustes](/app/ayuda/confirmaciones-y-ajustes).

## 5. Jornada válida

Cuando **todos** los partidos de la jornada están confirmados (o más avanzados), la jornada pasa automáticamente a **Válida** y se notifica a todos los involucrados. Si luego un ajuste vuelve a dejar un partido pendiente, la jornada regresa a **Enviada**.

## 6. Cerrar la jornada

**Cerrar jornada** solo funciona si **todos los partidos están cerrados o suspendidos**; si no, el mensaje indica los partidos abiertos. Tras el cierre solo se admiten notas o apelaciones.

## Eliminar una jornada

Solo en **Borrador** (ícono de papelera). Sus partidos vuelven al fixture *sin jornada*.
