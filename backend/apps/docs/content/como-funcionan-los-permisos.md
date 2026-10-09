---
title: Cómo funcionan los permisos
summary: Roles, permisos personalizados, superusuario y las comprobaciones adicionales de cada acción
section: permissions
order: 10
---
```futowl-mis-permisos
```

## Las tres piezas

| Pieza | Qué es | Dónde se gestiona |
|-------|--------|-------------------|
| **Permiso** | Autorización para **una acción concreta** (por ejemplo, *Cerrar partidos* = `competition.close_match`). | Catálogo fijo del sistema. |
| **Rol** | Conjunto de permisos con un nombre (*Delegado*, *Autoridad*…). | Administración → Roles y permisos. |
| **Usuario** | Recibe **uno o varios roles** y, opcionalmente, **permisos personalizados** adicionales. | Administración → Usuarios. |

Los **permisos efectivos** de un usuario son la **suma** de los permisos de todos sus roles más sus permisos personalizados. No existen permisos «negativos»: un rol nunca quita lo que otro da.

> [!TIP]
> Ejemplo: Ana tiene el rol *Árbitro* y, como permiso personalizado, *Devolver informes para corrección*. Puede hacer todo lo de un árbitro y, además, devolver informes.

## El superusuario

El **superusuario** es una marca especial de la cuenta (no un rol):

- Tiene **todos** los permisos, presentes y futuros, sin necesidad de asignarlos.
- Es el **único** que puede **editar esta documentación** (crear, modificar, publicar o despublicar páginas y ver su historial).
- Accede al panel técnico de Django.

El rol *Administrador* también recibe todos los permisos del catálogo, pero **no** convierte a la persona en superusuario.

## Cómo se lee el código de un permiso

`módulo.acción_objeto`, por ejemplo `registry.add_player`:

| Parte | Significado |
|-------|-------------|
| `registry` | Módulo: `registry` (Registro), `tournaments` (Torneos), `competition` (Competición), `accounts` (Usuarios), `auth` (Roles), `audit` (Auditoría), `legal` (Términos), `notifications` (Notificaciones). |
| `view_` / `add_` / `change_` / `delete_` | Ver / Crear / Editar (incluye desactivar y reactivar) / Eliminar. |
| Otras acciones | Permisos especiales del flujo: `close_match`, `operate_match`, `submit_matchday`… |

## Dónde se comprueban

Cada permiso se comprueba **dos veces**:

1. **En la pantalla**: el menú, las pestañas y los botones solo aparecen si tiene el permiso.
2. **En el servidor**: aunque alguien intentara la acción por otro medio, la API la rechaza con *«No tiene permisos para realizar esta acción»*.

Además, la API exige que el usuario haya **aceptado los términos** vigentes.

## Comprobaciones adicionales: el permiso no siempre basta

Varias acciones exigen el permiso **y** una relación con el registro:

| Acción | Además del permiso, se exige… |
|--------|-------------------------------|
| Confirmar/rechazar asignación | Ser la parte asignada: usuario vinculado al delegado o árbitro de esa posición, o gestor del equipo. |
| Operar la mesa técnica (`operate_match`) | Ser el **delegado asignado** al partido. `operate_any_match` lo omite. |
| Enviar informe del delegado / arbitral | Ser el delegado asignado / el **árbitro principal** del partido. |
| Cargar alineación | Ser gestor o entrenador vinculado del equipo (o tener `operate_any_match`). |
| Gestionar nómina, crear o editar jugadores, asignar entrenadores | Ser gestor o entrenador vinculado del equipo, salvo administradores del registro (`registry.change_team`) o del torneo (`tournaments.change_tournament` para la nómina). |
| Editar la ficha de un jugador | Pertenecer a su **equipo actual** (o ser administrador del registro). |

Y algunas acciones dependen del **estado** del registro (por ejemplo, solo se cierra un partido *Finalizado* con informes coincidentes). Esos requisitos están en cada capítulo del manual.

## Notificaciones por permiso

Algunos avisos se envían a **todos los usuarios activos que tengan un permiso**:

- `competition.resolve_reviewcase` → rechazos de asignación y apelaciones.
- `competition.close_match` → «Informes listos para cierre».

## Roles vigentes

Este listado se genera en vivo con los roles configurados actualmente (incluidos los personalizados). Pulse un rol para ver sus permisos.

```futowl-roles
```

Siguiente: [Roles predefinidos](/app/ayuda/roles-predefinidos) · [Catálogo de permisos](/app/ayuda/catalogo-de-permisos) · [Crear roles y asignar permisos](/app/ayuda/crear-roles-y-asignar-permisos)
