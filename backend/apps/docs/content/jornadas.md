---
title: Jornadas
summary: Armar el día de competencia, validaciones de solapamiento, enviar y cerrar la jornada
section: manual
order: 150
---
**Rutas:** Competición → Jornadas (`/app/jornadas`) o la pestaña *Jornadas* del torneo · **Capacidades:** *Consultar torneos y partidos* (ver); *Programar jornadas y partidos* (crear, programar y eliminar borradores); *Asignar delegados* / *Asignar árbitros* (solo los oficiales); *Enviar jornadas a confirmación*; *Cerrar jornadas*.

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

> [!NOTE]
> Con *Programar jornadas y partidos* se completa toda la tarjeta. El **jefe de delegados** (*Asignar delegados*) solo puede elegir el **delegado** y el **jefe de árbitros** (*Asignar árbitros*) solo la **terna arbitral**: para ellos, cancha, inicio y quitar el partido de la jornada aparecen desactivados.

Pulse **Guardar** en la tarjeta. FutOwl valida al instante:

- **Capacidad de la cancha** y **mini cancha** libre (la asigna sola si la cancha es divisible).
- Que el **delegado** no tenga otro partido a la misma hora.
- Que ningún **árbitro** tenga otro partido a la misma hora (en ninguna posición) y que no repita posición en la terna.
- Que **ninguno de los equipos** juegue otro partido a la misma hora.

El error aparece debajo del campo correspondiente. Cada tarjeta indica **Completo** o **Falta: …**.

> [!TIP]
> Para enviar la jornada basta con **cancha y horario** en cada partido. Delegado y árbitros son opcionales en borrador: normalmente los asignan los jefes después del envío. Mientras a algún partido le falte cancha u horario, **Enviar jornada** permanece deshabilitado.

## 4. Enviar la jornada

**Enviar jornada** (lo hacen las autoridades, siempre con confirmación). FutOwl vuelve a validar los solapamientos y que cada partido sea del día de la jornada. Si todo está bien:

- Cada partido pasa a **Pendiente de confirmación**; su **cancha y horario quedan bloqueados**.
- Se **notifica a los jefes de delegados y de árbitros** para que asignen a los oficiales. Si algún oficial ya estaba asignado, recibe la solicitud de confirmación.
- La jornada pasa a **Enviada** y ya no puede eliminarse.

A partir de aquí, cambiar cancha u horario requiere un **ajuste** con exposición de motivos desde la ficha del partido. Vea [Confirmaciones y ajustes](/app/ayuda/confirmaciones-y-ajustes).

## 5. Asignar los oficiales (jefes)

En la jornada enviada, el **jefe de delegados** (*Asignar delegados*) y el **jefe de árbitros** (*Asignar árbitros*) ven cada partido pendiente con cancha y horario bloqueados y eligen **solo** a sus oficiales; la tarjeta indica *Falta: …* hasta completar. Al pulsar **Asignar**, cada oficial recibe la solicitud de confirmación. Un oficial que ya confirmó solo se cambia con un ajuste.

Cuando el delegado y la terna exigida **confirman**, el partido queda **Confirmado y bloqueado**, y recién entonces se **avisa a los equipos**, que confirman su asistencia de forma informativa.

## 6. Jornada válida

Cuando **todos** los partidos de la jornada están confirmados (o más avanzados), la jornada pasa automáticamente a **Válida** y se notifica a todos los involucrados. Si luego un ajuste vuelve a dejar un partido pendiente, la jornada regresa a **Enviada**.

## 7. Cerrar la jornada

**Cerrar jornada** solo funciona si **todos los partidos están cerrados o suspendidos**; si no, el mensaje indica los partidos abiertos. Tras el cierre solo se admiten notas o apelaciones.

## Eliminar una jornada

Solo en **Borrador** (ícono de papelera). Sus partidos vuelven al fixture *sin jornada*.
