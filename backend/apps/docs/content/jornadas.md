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

## Generar jornadas automáticamente

**Generar jornadas** (en la lista de jornadas del torneo o en *Competición → Jornadas*, eligiendo el torneo) arma de una vez el calendario con los partidos del torneo que siguen en **borrador y sin jornada**:

| Dato | Uso |
|------|-----|
| **Día de apertura** | Primer día desde el que se buscan días de juego (no antes del inicio del torneo; se detiene en su fecha de fin). |
| **Días de cada cancha** | Días de la semana en que se puede jugar en cada cancha (botones *Lu … Do* de su fila). Por defecto, **todos los días**. Hay una jornada por cada día en que al menos una cancha se puede usar, y ese día solo se usan esas canchas. |
| **Horario de cada cancha** | Hora de **inicio** y **hora límite** de cada cancha. Por defecto todas van de **9:00 a 18:00**. Cambie una fila o use la fila *Todas las canchas* (días y horario) → **Aplicar a todas**. Desmarque una cancha para no usarla. |
| Categorías | Por defecto, todas las del torneo; pulse una para excluirla. |

Reglas del reparto:

- Una **jornada por día de juego** (los días en que alguna cancha se puede usar); se saltan los días que ya tienen una jornada del torneo. Ejemplo: si la *Cancha 1* solo se usa sábado y domingo y las demás todos los días, de lunes a viernes se juega sin la Cancha 1.
- Se respeta el orden del fixture: **Fecha 1, Fecha 2…** de todas las categorías y después la **eliminación directa** por ronda.
- Un equipo juega **un solo partido por jornada**.
- En cada cancha los partidos se **encadenan** desde la hora de inicio **de esa cancha** con la duración de su categoría (duración más descansos), varios a la vez si la cancha es **divisible** (según las medidas de juego de cada categoría: 8 de Sub 6 o 2 de Sub 12 en una cancha de 100 × 64 m, y se pueden mezclar categorías mientras quepan), y respetando lo que ya ocupa esa cancha ese día.
- El último partido de una cancha puede terminar como máximo **30 minutos después de su hora límite** (con límite 18:00, el último partido termina a más tardar a las 18:30). La columna *Último partido hasta* lo muestra.
- **Misma capacidad toda la jornada en cada cancha** (opción activada por defecto): una cancha divisible se arma **una sola vez por día**. Si arranca con 4 partidos a la vez, todo el día juega 4 a la vez y solo recibe categorías de ese tamaño (por ejemplo Sub 8 y Sub 10); otra cancha puede ser de 8 a la vez (Sub 6) y otra de cancha completa (Sub 16). Las canchas se reparten según lo que pide cada jornada: primero una para cada tamaño que juega ese día y luego más canchas al tamaño con más partidos. Al abrir una jornada en **Ver plan** se ve cómo quedó armada cada cancha (*Cancha 3: 8 a la vez*). Con esta regla el calendario puede necesitar alguna jornada más; desactívela si prefiere mezclar tamaños en una cancha.
- La eliminación directa de una categoría empieza en una jornada **posterior** a su fase de grupos, cada ronda después de la anterior y la **vuelta** después de la ida.

Primero pulse **Ver plan**: muestra cada jornada con su día, horario y partidos (cancha, hora, categoría y fase) y avisa si quedan partidos sin ubicar. Si no caben todos antes de la fecha de fin del torneo, amplíe el horario de las canchas o agregue días de juego. Nada se guarda hasta pulsar **Crear jornadas**; se crean en **borrador** con cancha y horario, listas para revisar y enviar.

## 2. Vista por canchas

Al abrir la jornada aparece **una tarjeta por cancha** (las del torneo; si el torneo no indicó canchas, todas las activas) con sus **medidas** y, si es divisible, cuántos partidos **de cada categoría de la jornada** entran a la vez (por ejemplo *8 de Sub 6 · 2 de Sub 12*). Cada tarjeta lista sus partidos por hora. Los partidos agregados sin cancha aparecen primero en la tarjeta **Sin cancha asignada**. Arriba, unos contadores indican cuántos partidos hay y cuántos están sin cancha o sin hora.

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

- **Espacio en la cancha**: cada partido ocupa la fracción que le toca por su categoría (1/8, 1/2, completa) y la suma no puede pasar de la cancha; la **mini cancha** libre se asigna sola (*mini cancha 3 de 8*).
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

Solo en **Borrador** (ícono de papelera). Sus partidos vuelven al fixture *sin jornada, cancha ni horario*.

Para eliminar varias a la vez, en la lista de jornadas marque las casillas de las jornadas en borrador o pulse **Seleccionar todas las jornadas en borrador** y luego **Eliminar** (con confirmación). Las jornadas enviadas o posteriores no se pueden seleccionar ni eliminar.
