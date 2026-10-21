---
title: Equipos
summary: Crear un club, su ficha, categorías, cuerpo técnico, plantel y usuarios de acceso
section: manual
order: 80
---
**Ruta:** Registro → Equipos (`/app/equipos`) · **Capacidades:** *Consultar el registro* para ver; *Administrar todos los equipos* para crear clubes y editar cualquier equipo. Gestores y entrenadores manejan lo de **su** equipo con *Gestionar plantilla*, *Gestionar entrenadores* y *Gestionar nómina*.

## Crear un equipo

Botón **Nuevo equipo**. Datos:

| Campo | Notas |
|-------|-------|
| **Nombre** | Único en el sistema. |
| **RIF** | Tipo (V, E, J, G) + número. Se guarda cifrado y no puede repetirse. |
| Logo | Imagen JPG, PNG o WEBP (máx. 5 MB). |
| Documento RIF | PDF, Word o imagen (máx. 10 MB). |
| Ubicación | País, estado, municipio y dirección. |
| **Usuario de acceso** | **Obligatorio al crear**: *Vincular existente* o *Crear usuario*. Ese usuario será **gestor** del equipo y recibe el rol *Gestor de equipo*. |

> [!NOTE]
> Las categorías, el cuerpo técnico y la nómina **no** se cargan al crear el equipo: se gestionan después en la ficha.

> [!TIP]
> Si es gestor de equipo o entrenador, sus equipos aparecen **primero** en el listado, resaltados en dorado y con la etiqueta *Mi equipo*.

## La ficha del equipo

Pulse un equipo del listado. Arriba verá logo, RIF, dirección, categorías, cuerpo técnico, cantidad de jugadores actuales y usuarios de acceso. Pestañas:

### Nómina por torneo

Muestra los **torneos donde está inscrito el equipo**, cada uno con sus **categorías** y cuántos jugadores hay en la nómina de cada una (las que aún no tienen nómina se resaltan). Pulse un torneo, o directamente una categoría, para abrirlo: cada **categoría inscrita es una página** (pestaña) con su nómina. *Todos los torneos* vuelve a la lista. En la página de la categoría use:

- **Cargar categoría**: propone, ya marcados, los jugadores del plantel actual que son de esa categoría (con su último dorsal en el equipo, si sigue libre). Solo queda revisar, ajustar dorsales y confirmar.
- **Inscribir jugador**: busca jugadores ya registrados que sean **elegibles** para la categoría y estén **libres** en ese torneo.
- **Nuevo jugador**: crea la ficha y la inscribe en un solo paso.
- Ícono de lápiz: **edita la ficha** del jugador (datos, fotos, documento, representante).
- **Dorsal**: se edita en la misma tabla; pulse el número, cámbielo y salga del campo (o Enter). Esc lo deja como estaba. No se puede repetir un dorsal de la nómina.
- Ícono de baja: **da de baja** al jugador de la nómina (el registro se conserva). Para dar de baja a **varios**, márquelos con las casillas (o *Seleccionar todos*) y pulse **Dar de baja**.

Detalle en [Inscripciones, grupos y nómina](/app/ayuda/inscripciones-grupos-y-nomina).

### Jugadores

Arriba hay un **buscador** (nombre o documento) y filtros por **categoría** (la del jugador en el equipo: la más baja en la que entra por edad), **situación** (en el plantel, libre o en otro equipo) y **torneo** jugado con el equipo.

- **Plantel actual**: jugadores cuyo *equipo actual* es este. El equipo puede actualizar su ficha (fotos, documento…) con el ícono de lápiz; pulsar la fila abre su perfil.
  - **Desvincular** (ícono de quitar): el jugador salió del equipo (p. ej. dejó la escuela) y queda **libre**; otro equipo puede incorporarlo. Sus nóminas de torneos no cambian: si ya no jugará, dele de baja desde *Nómina por torneo*.
  - **Incorporar un jugador libre**: busque por nombre o cédula a un jugador sin equipo y súmelo al plantel.
- **Desvinculados y anteriores**: los que el equipo desvinculó y los que estuvieron en alguna de sus nóminas y hoy están en otro equipo o libres. A los **libres** se les puede **readmitir** (ícono de volver).

### Cuerpo técnico

Busque y **asigne** entrenadores **libres** al equipo, o pulse **Nuevo entrenador** para registrarlo (con licencia y, si quiere, usuario de acceso) y dejarlo asignado en un solo paso (*Gestionar entrenadores*). El ícono de lápiz **edita** sus datos, licencia y usuario de acceso (solo los entrenadores del propio equipo, salvo un administrador); el ícono de quitar lo libera. Un entrenador solo puede estar en **un equipo a la vez** y no puede dirigir a dos equipos del mismo torneo en curso.

### Categorías

Marque las categorías en las que compite el equipo y pulse **Guardar categorías**. Solo un administrador del registro (*Administrar todos los equipos*) puede cambiarlas.

### Acceso (solo administradores)

Usuarios **gestores** del equipo: cargan nómina y alineaciones y confirman asistencia. **Agregar usuario** vincula uno existente o crea uno nuevo; el ícono de quitar le retira el acceso.

## Quién puede hacer qué en un equipo

| Acción | Administrador del registro (*Administrar todos los equipos*) | Gestor del equipo / entrenador con usuario |
|--------|:---:|:---:|
| Editar datos del equipo, categorías, acceso | ✅ | ❌ |
| Inscribir/dar de baja jugadores en la nómina | ✅ | ✅ (con *Gestionar nómina*) |
| Desvincular, readmitir o incorporar jugadores libres | ✅ | ✅ solo en su equipo (con *Gestionar plantilla*) |
| Crear jugadores para el equipo | ✅ | ✅ (con *Gestionar plantilla*) |
| Actualizar la ficha de jugadores del plantel actual | ✅ | ✅ (con *Gestionar plantilla*) |
| Asignar o liberar entrenadores | ✅ | ✅ solo entrenadores libres o propios (con *Gestionar entrenadores*) |

> [!IMPORTANT]
> Además del permiso, FutOwl verifica que el usuario sea **gestor** del equipo o el **entrenador vinculado**. Un gestor de *Águilas FC* no puede tocar la nómina de *Toros* aunque tenga el permiso.
