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

Botón **+ Jornada**: torneo (si se crea desde el menú general), **número** (único dentro del torneo), **día** y nombre opcional (*Jornada 1 · Apertura*). Queda en **Borrador** y se abre su ficha. El día debe estar dentro de las fechas del torneo y con un año entre 2000 y 2099 (un año mal escrito, como *0026*, se rechaza: además de ser otra fecha, haría que las horas se mostraran corridas).

Mientras está en borrador, **Editar** (junto al título) cambia número, día o nombre. Si cambia el **día**, los partidos ya programados se mueven a esa fecha con la **misma hora**; si en el nuevo día alguno chocara con otro partido de la misma cancha o equipo, no se cambia nada y se indica el motivo.

## 2. Vista por canchas

Al abrir la jornada aparece **una tarjeta por cancha** (las del torneo; si el torneo no indicó canchas, todas las activas) con su **capacidad**: cuántos partidos admite a la vez y, si es divisible, cuántas mini canchas tiene. Cada tarjeta lista sus partidos por hora. Los partidos agregados sin cancha aparecen primero en la tarjeta **Sin cancha asignada**. Arriba, unos contadores indican cuántos partidos hay y cuántos están sin cancha o sin hora.

## 3. Agregar partidos

**Agregar partidos** (arriba) o **Agregar partidos a esta cancha** (al pie de cada tarjeta) abre una **tabla** con los partidos del torneo en **Borrador** que aún **no tienen jornada**:

- **Buscar** por equipo.
- **Filtros:** categoría, fecha, ida/vuelta (*Partido único*, *Solo ida*, *Solo vuelta*) y **fase**: *Fase de grupos* (con cada **grupo** como subfiltro) o *Eliminatoria* (con cada **ronda**: 32avos … final).
- **Agrupar** las filas por fecha, por fase o por categoría.
- Marque partidos uno a uno o con la casilla del encabezado (todos los filtrados), elija la **cancha** (opcional; viene puesta si se abrió desde una tarjeta) y pulse **Agregar**.

Para sacar un partido de la jornada use la **X** de su fila.

## 4. Hora y cancha (se guarda solo)

En cada partido solo se indica la **hora de inicio** (UTC-4, del día de la jornada): la **hora de fin se calcula sola** con las reglas de la categoría (duración del partido más los descansos) y se muestra como *Fin ≈ …*. La **cancha** se cambia con el selector de la fila y el partido pasa a la tarjeta de esa cancha.

**No hay botón Guardar:** cada cambio se guarda al momento y la fila muestra *Guardando…*, *Guardado* o *No guardado* con el motivo. FutOwl valida al instante:

- **Capacidad de la cancha** y **mini cancha** libre (la asigna sola si la cancha es divisible).
- Que **ninguno de los equipos** juegue otro partido a la misma hora.

Cada fila indica lo que falta (*Falta: cancha, hora de inicio…*). Los cruces de la llave cuyos equipos aún no se conocen muestran *equipos por definir*: pueden programarse, pero no enviarse hasta que se completen.

> [!TIP]
> En borrador solo se completan **cancha y hora**: el delegado y los árbitros los asignan los jefes después del envío. Mientras a algún partido le falte cancha u hora, **Enviar jornada** permanece deshabilitado.

## 5. Enviar la jornada

**Enviar jornada** (lo hacen las autoridades, siempre con confirmación). FutOwl vuelve a validar los solapamientos y que cada partido sea del día de la jornada. Si todo está bien:

- Cada partido pasa a **Pendiente de confirmación**; su **cancha y horario quedan bloqueados**.
- Se **notifica a los jefes de delegados y de árbitros** para que asignen a los oficiales. Si algún oficial ya estaba asignado, recibe la solicitud de confirmación.
- La jornada pasa a **Enviada** y ya no puede eliminarse.

A partir de aquí, cambiar cancha u horario requiere un **ajuste** con exposición de motivos desde la ficha del partido. Vea [Confirmaciones y ajustes](/app/ayuda/confirmaciones-y-ajustes).

## 6. Asignar los oficiales (jefes)

En la jornada enviada, el **jefe de delegados** (*Asignar delegados*) y el **jefe de árbitros** (*Asignar árbitros*) ven cada partido pendiente con cancha y horario bloqueados y eligen **solo** a sus oficiales; la fila indica *Falta: …* hasta completar. La asignación **se guarda al elegir** a cada oficial (sin botón), y ese oficial recibe en ese momento la solicitud de confirmación. Un oficial que ya confirmó solo se cambia con un ajuste.

Cuando el delegado y la terna exigida **confirman**, el partido queda **Confirmado y bloqueado**, y recién entonces se **avisa a los equipos**, que confirman su asistencia de forma informativa.

## 7. Jornada válida

Cuando **todos** los partidos de la jornada están confirmados (o más avanzados), la jornada pasa automáticamente a **Válida** y se notifica a todos los involucrados. Si luego un ajuste vuelve a dejar un partido pendiente, la jornada regresa a **Enviada**.

## 8. Cerrar la jornada

**Cerrar jornada** solo funciona si **todos los partidos están cerrados o suspendidos**; si no, el mensaje indica los partidos abiertos. Tras el cierre solo se admiten notas o apelaciones.

## Eliminar una jornada

Solo en **Borrador** (ícono de papelera). Sus partidos vuelven al fixture *sin jornada*.
