---
title: Inscripciones, grupos y nómina
summary: Inscribir equipos en un torneo, organizarlos en grupos y cargar la nómina de jugadores
section: manual
order: 130
---
## Inscribir equipos

**Torneo → Equipos y grupos → Inscribir equipo** (permiso `tournaments.add_tournamentteam`):

1. **Categoría**: una de las permitidas por el torneo.
2. **Equipo**: el listado muestra entre paréntesis las categorías de cada equipo.
3. **Grupo** (opcional).

FutOwl valida que:

- La categoría esté permitida en el torneo → si no: *«La categoría no está permitida en este torneo»*.
- El equipo tenga registrada esa categoría → si no: *«El equipo no tiene registrada esta categoría»* (agréguela en la ficha del equipo, pestaña *Categorías*).
- No exista ya la misma inscripción (equipo + torneo + categoría).
- El grupo corresponda al mismo torneo y categoría.

Un mismo equipo puede inscribirse en **varias categorías** del torneo (una inscripción por categoría).

## Grupos

**Torneo → Equipos y grupos → + Grupo** (permiso `tournaments.add_group`): nombre (*Grupo A*) y categoría. El nombre es único por torneo y categoría.

Para asignar un equipo a un grupo, use el selector **Grupo** en su fila de *Equipos inscritos* (permiso `tournaments.change_tournamentteam`). Si no hay grupos, el torneo funciona como **liga única** por categoría.

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
