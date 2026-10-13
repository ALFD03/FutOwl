---
title: Inscripciones, grupos y nómina
summary: Inscribir equipos en un torneo, organizarlos en grupos y cargar la nómina de jugadores
section: manual
order: 130
---
## Inscribir equipos

**Torneo → Equipos → Inscribir equipo** (capacidad *Inscripciones y grupos*):

1. **Equipo**: el buscador solo muestra equipos que tienen alguna categoría del torneo, con sus categorías y en cuántas ya está inscrito.
2. **Categorías**: aparecen todas las del torneo. Marque **una o varias** de las que el equipo puede jugar (o **Marcar todas**); las que ya tiene inscritas salen como *Ya inscrito* y las que el equipo no tiene registradas aparecen desactivadas.
3. **Grupo** (opcional): junto a cada categoría marcada, si esa categoría ya tiene grupos.
4. Pulse **Inscribir**: se crea una inscripción por categoría. Si alguna falla, se avisa el motivo y esa categoría queda marcada para reintentar; las demás quedan inscritas.

FutOwl valida que:

- La categoría esté permitida en el torneo → si no: *«La categoría no está permitida en este torneo»*.
- El equipo tenga registrada esa categoría → si no: *«El equipo no tiene registrada esta categoría»* (agréguela en la ficha del equipo, pestaña *Categorías*).
- No exista ya la misma inscripción (equipo + torneo + categoría).
- El grupo corresponda al mismo torneo y categoría.

Un mismo equipo puede inscribirse en **varias categorías** del torneo (una inscripción por categoría). La pestaña **Equipos** muestra **una fila por equipo**: púlsela para ver sus categorías, su grupo y su nómina.

## Grupos

La pestaña **Grupos** solo aparece si la modalidad del torneo es *Fase de grupos* o *Grupos + eliminación directa* (capacidad *Inscripciones y grupos*). Elija la categoría arriba:

- **+ Grupo**: crea un grupo (*Grupo A*); el nombre es único por torneo y categoría.
- Cada tarjeta muestra los equipos del grupo; el selector junto a cada equipo lo cambia de grupo o lo deja sin grupo.
- **Equipos sin grupo**: los inscritos que aún no tienen grupo.
- **Sortear grupos**: indique la cantidad de grupos (se sugiere uno cada 4 equipos y se muestra cómo quedarían) y FutOwl reparte **al azar** los equipos de la categoría, con grupos lo más parejos posible. Rehacer el sorteo borra los grupos actuales, sus partidos en borrador y la llave; no es posible si ya hay partidos enviados.
- **Generar fixture de grupos**: crea de una vez los partidos (todos contra todos) de cada grupo que aún no los tenga.

Si el torneo tiene eliminación directa, la llave se configura en su propia pestaña: vea [Eliminación directa](/app/ayuda/eliminacion-directa).

Los grupos se usan para:

- Generar el fixture **solo entre los equipos del grupo**.
- Mostrar una **tabla de posiciones por grupo**.

## Nómina por torneo

La nómina es la lista de jugadores habilitados para jugar con un equipo **en ese torneo y categoría**. Solo los jugadores de la nómina pueden ir a una alineación.

**Dónde:** Registro → Equipos → (equipo) → **Nómina por torneo**. Desde el torneo, la columna *Nómina* de cada equipo inscrito lleva directo a esa pestaña.

**Quién:** administradores del registro o del torneo, y los **gestores / entrenadores con usuario** del propio equipo (con permisos de nómina).

### Inscribir jugadores

1. Elija el torneo/categoría en el selector.
2. **Inscribir jugador** → busque al jugador (solo aparecen los **elegibles por año de nacimiento** y **libres** en ese torneo) → indique el **dorsal** (0 a 99, opcional) → **Inscribir**.
3. O **Nuevo jugador** para crear la ficha e inscribirla de una vez.

Al inscribirlo, el equipo pasa a ser el **equipo actual** del jugador.

### Dar de baja

El ícono de baja en la fila desactiva la inscripción (el registro histórico se conserva). Para **cambiar a un jugador de equipo dentro del mismo torneo**, primero debe darse de baja en el equipo anterior y luego inscribirse en el nuevo. Al reactivar una inscripción, FutOwl verifica de nuevo que el jugador siga libre y que el dorsal esté disponible.

> [!WARNING]
> Cuando el torneo está **Finalizado**, su nómina ya no se puede modificar.

## Ejemplo

*Copa Apertura 2026 · Sub 12*: el gestor de Águilas FC inscribe a 16 jugadores con dorsales del 1 al 16. Si intenta usar otra vez el dorsal 10, FutOwl responde *«Ese dorsal ya está asignado en la nómina»*.
