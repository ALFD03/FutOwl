---
title: Inscripciones, grupos y nómina
summary: Inscribir equipos en un torneo, organizarlos en grupos y cargar la nómina de jugadores
section: manual
order: 130
---
## Inscribir equipos

**Torneo → Equipos → Inscribir equipos** (capacidad *Inscripciones y grupos*). Se pueden inscribir **varios equipos a la vez**:

1. **Lista de equipos**: aparecen los que tienen alguna categoría del torneo. Use el **buscador** o los botones de **Categoría** para acotarla. Los que ya están inscritos en todas sus categorías salen al final, desactivados.
2. **Marque los equipos**: al marcar uno quedan marcadas **todas las categorías del torneo que tiene disponibles**. Pulse una categoría para quitarla o volver a ponerla; las que ya tiene inscritas salen en verde. Si quita algunas, la casilla del equipo queda a medias (—).
3. **Marcar todos**: marca todos los equipos de la lista. Con una categoría elegida en el filtro, marca a los equipos visibles **solo en esa categoría**.
4. Pulse **Inscribir (n)**: abajo se ve cuántos equipos e inscripciones se van a crear. Si alguna falla, se avisa el motivo y solo esa queda marcada para reintentar; las demás quedan inscritas. Una inscripción que se había desactivado se reactiva.

FutOwl valida que:

- La categoría esté permitida en el torneo → si no: *«La categoría no está permitida en este torneo»*.
- El equipo tenga registrada esa categoría → si no: *«El equipo no tiene registrada esta categoría»* (agréguela en la ficha del equipo, pestaña *Categorías*).
- No exista ya la misma inscripción (equipo + torneo + categoría).
- El grupo corresponda al mismo torneo y categoría.

Un mismo equipo puede inscribirse en **varias categorías** del torneo (una inscripción por categoría). La pestaña **Equipos** muestra **una fila por equipo**: púlsela para ver sus categorías, su grupo y su nómina.

## Grupos

La pestaña **Grupos** solo aparece si la modalidad del torneo es *Grupos + eliminación directa* (capacidad *Inscripciones y grupos*). Elija la categoría arriba:

- **+ Grupo**: crea un grupo (*Grupo A*); el nombre es único por torneo y categoría.
- Cada tarjeta muestra los equipos del grupo; el selector junto a cada equipo lo cambia de grupo o lo deja sin grupo. Al hacerlo, el **fixture de los grupos afectados se rehace solo** (todos contra todos, ida y vuelta si el torneo lo indica), siempre que sus partidos sigan en borrador y sin jornada; si ya están programados o enviados, el fixture no se toca y FutOwl lo avisa.
- **Equipos sin grupo**: los inscritos que aún no tienen grupo.
- **Sortear grupos**: indique la cantidad de grupos (se sugiere uno cada 4 equipos y se muestra cómo quedarían) y FutOwl reparte **al azar** los equipos de la categoría, con grupos lo más parejos posible, y **crea de una vez los partidos de cada grupo** (pestaña **Partidos**). Rehacer el sorteo borra los grupos actuales, sus partidos en borrador y la llave; no es posible si ya hay partidos enviados.
- **Generar fixture de grupos**: crea los partidos de los grupos que aún no los tengan (por ejemplo, grupos armados a mano que quedaron con un solo equipo y luego se completaron).

Si el torneo tiene eliminación directa, la llave se configura en su propia pestaña: vea [Eliminación directa](/app/ayuda/eliminacion-directa).

Los grupos se usan para:

- Generar el fixture **solo entre los equipos del grupo**.
- Mostrar una **tabla de posiciones por grupo**.

## Nómina por torneo

La nómina es la lista de jugadores habilitados para jugar con un equipo **en ese torneo y categoría**. Solo los jugadores de la nómina pueden ir a una alineación.

**Dónde:** Registro → Equipos → (equipo) → **Nómina por torneo**. Ahí aparece la lista de torneos del equipo con sus categorías; al abrir un torneo, cada categoría inscrita tiene su propia página. Desde el torneo, la columna *Nómina* de cada equipo inscrito lleva directo a la página de esa categoría.

**Quién:** administradores del registro o del torneo, y los **gestores / entrenadores con usuario** del propio equipo (con permisos de nómina).

### Inscribir jugadores

1. Abra el torneo y elija la pestaña de la categoría.
2. **Cargar categoría** (lo habitual): FutOwl propone los jugadores del **plantel actual** del equipo elegibles para la categoría y libres en el torneo.
   - Vienen **marcados** los que son de esa categoría (su categoría en el equipo, la más baja en la que entran por edad, es esta).
   - Los de **categorías menores** aparecen en *Otros elegibles*, sin marcar: si los marca, juegan esta categoría y ya no podrán jugar otra del mismo torneo.
   - El **dorsal** sugerido es el último que usó con el equipo (si sigue libre). **Numerar los sin dorsal** asigna los primeros números libres. Los dorsales repetidos se señalan antes de enviar.
   - Revise y pulse **Inscribir (n)**. Cada jugador se guarda por separado: si alguno falla, se avisa el motivo y los demás quedan inscritos.
3. **Inscribir jugador** para sumar a uno solo → busque al jugador (solo aparecen los **elegibles por año de nacimiento** y **libres** en ese torneo) → indique el **dorsal** (0 a 99, opcional) → **Inscribir**.
4. O **Nuevo jugador** para crear la ficha e inscribirla de una vez.

Al inscribirlo, el equipo pasa a ser el **equipo actual** del jugador.

### Dar de baja

El ícono de baja en la fila desactiva la inscripción (el registro histórico se conserva). Para **cambiar a un jugador de equipo dentro del mismo torneo**, primero debe darse de baja en el equipo anterior y luego inscribirse en el nuevo. Al reactivar una inscripción, FutOwl verifica de nuevo que el jugador siga libre y que el dorsal esté disponible.

> [!WARNING]
> Cuando el torneo está **Finalizado**, su nómina ya no se puede modificar.

## Ejemplo

*Copa Apertura 2026 · Sub 12*: el gestor de Águilas FC inscribe a 16 jugadores con dorsales del 1 al 16. Si intenta usar otra vez el dorsal 10, FutOwl responde *«Ese dorsal ya está asignado en la nómina»*.
