---
title: Equipos
summary: Crear un club, su ficha, categorías, cuerpo técnico, plantel y usuarios de acceso
section: manual
order: 80
---
**Ruta:** Registro → Equipos (`/app/equipos`) · **Permisos:** `registry.view_team` para ver; `registry.add_team` para crear; `registry.change_team` para editar cualquier equipo (administrador del registro).

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

## La ficha del equipo

Pulse un equipo del listado. Arriba verá logo, RIF, dirección, categorías, cuerpo técnico, cantidad de jugadores actuales y usuarios de acceso. Pestañas:

### Nómina por torneo

Lista los jugadores inscritos con el equipo en un torneo/categoría. Elija la inscripción en el selector y use:

- **Inscribir jugador**: busca jugadores ya registrados que sean **elegibles** para la categoría y estén **libres** en ese torneo.
- **Nuevo jugador**: crea la ficha y la inscribe en un solo paso.
- Ícono de baja: **da de baja** al jugador de la nómina (el registro se conserva).

Detalle en [Inscripciones, grupos y nómina](/app/ayuda/inscripciones-grupos-y-nomina).

### Jugadores

- **Plantel actual**: jugadores cuyo *equipo actual* es este. El equipo puede actualizar su ficha (fotos, documento…).
- **Han jugado con el equipo**: historial de quienes estuvieron en alguna nómina y hoy están en otro equipo o libres.

### Cuerpo técnico

Asigne entrenadores **libres** al equipo o libérelos. Un entrenador solo puede estar en **un equipo a la vez** y no puede dirigir a dos equipos del mismo torneo en curso.

### Categorías

Marque las categorías en las que compite el equipo y pulse **Guardar categorías**. Solo un administrador del registro (`registry.change_team`) puede cambiarlas.

### Acceso (solo administradores)

Usuarios **gestores** del equipo: cargan nómina y alineaciones y confirman asistencia. **Agregar usuario** vincula uno existente o crea uno nuevo; el ícono de quitar le retira el acceso.

## Quién puede hacer qué en un equipo

| Acción | Administrador del registro (`registry.change_team`) | Gestor del equipo / entrenador con usuario |
|--------|:---:|:---:|
| Editar datos del equipo, categorías, acceso | ✅ | ❌ |
| Inscribir/dar de baja jugadores en la nómina | ✅ | ✅ (con `tournaments.add_teamplayer` y `tournaments.change_teamplayer`) |
| Crear jugadores para el equipo | ✅ | ✅ (con `registry.add_player`) |
| Actualizar la ficha de jugadores del plantel actual | ✅ | ✅ (con `registry.change_player`) |
| Asignar o liberar entrenadores | ✅ | ✅ solo entrenadores libres o propios (con `registry.change_coach`) |

> [!IMPORTANT]
> Además del permiso, FutOwl verifica que el usuario sea **gestor** del equipo o el **entrenador vinculado**. Un gestor de *Águilas FC* no puede tocar la nómina de *Toros* aunque tenga el permiso.
