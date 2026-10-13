---
title: Cómo funcionan los permisos
summary: Capacidades, roles, capacidades extra por usuario, superusuario y las comprobaciones adicionales de cada acción
section: permissions
order: 10
---
```futowl-mis-permisos
```

## Las tres piezas

| Pieza | Qué es | Dónde se gestiona |
|-------|--------|-------------------|
| **Capacidad** | Una **función concreta** del sistema, con nombre y explicación: *Asignar árbitros*, *Cerrar partidos*, *Gestionar plantilla*… Son unas 35, agrupadas por área. | Catálogo fijo del sistema ([Catálogo de capacidades](/app/ayuda/catalogo-de-permisos)). |
| **Rol** | Conjunto de capacidades con un nombre (*Delegado*, *Autoridad*…). | Administración → Roles y permisos. |
| **Usuario** | Recibe **uno o varios roles** y, opcionalmente, **capacidades extra** solo para él. | Administración → Usuarios. |

Lo que un usuario puede hacer es la **suma** de las capacidades de todos sus roles más sus capacidades extra. No existen capacidades «negativas»: un rol nunca quita lo que otro da.

> [!TIP]
> Ejemplo: Ana tiene el rol *Árbitro* y, como capacidad extra, *Devolver informes*. Puede hacer todo lo de un árbitro y, además, devolver informes.

## El superusuario

El **superusuario** es una marca especial de la cuenta (no un rol):

- Tiene **todas** las capacidades, presentes y futuras, sin necesidad de asignarlas.
- Es el **único** que puede **editar esta documentación** (crear, modificar, publicar o despublicar páginas y ver su historial).
- Accede al panel técnico de Django.

El rol *Administrador* también recibe todas las capacidades, pero **no** convierte a la persona en superusuario.

## Capacidades y permisos técnicos

Por dentro, cada capacidad activa los **permisos técnicos** que necesita (por ejemplo, *Gestionar canchas* activa «crear canchas» y «editar canchas»). Usted nunca los asigna uno por uno: solo elige capacidades. Los permisos técnicos que no forman parte de ninguna capacidad no habilitan nada y no se asignan.

## Dónde se comprueban

Cada capacidad se comprueba **dos veces**:

1. **En la pantalla**: el menú, las pestañas y los botones solo aparecen si la tiene.
2. **En el servidor**: aunque alguien intentara la acción por otro medio, la API la rechaza con *«No tiene permisos para realizar esta acción»*.

Además, la API exige que el usuario haya **aceptado los términos** vigentes.

## Comprobaciones adicionales: la capacidad no siempre basta

Varias acciones exigen la capacidad **y** una relación con el registro:

| Acción | Además de la capacidad, se exige… |
|--------|-----------------------------------|
| *Confirmar asistencia* | Ser la parte asignada: usuario vinculado al delegado o árbitro de esa posición, o gestor del equipo. |
| *Mesa técnica de sus partidos* | Ser el **delegado asignado** al partido. *Mesa técnica de cualquier partido* lo omite. |
| *Informe del delegado* / *Informe arbitral* | Ser el delegado asignado / el **árbitro principal** del partido. |
| *Cargar alineaciones* | Ser gestor o entrenador vinculado del equipo (o tener *Mesa técnica de cualquier partido*). |
| *Gestionar plantilla*, *Gestionar entrenadores*, *Gestionar nómina* | Ser gestor o entrenador vinculado del equipo, salvo con *Administrar todos los equipos* (o *Gestionar torneos* para la nómina). Lo que no tiene equipo solo lo modifica quien lo registró. |
| *Notas y apelaciones* | Ser parte del partido (oficial asignado o cuerpo de uno de los equipos), salvo autoridades y jefes de oficiales. |
| *Asignar delegados* / *Asignar árbitros* | Solo cambian el oficial de su tipo: cancha, horario y jornada quedan para *Programar jornadas y partidos*. |

Y algunas acciones dependen del **estado** del registro (por ejemplo, solo se cierra un partido *Finalizado* con informes coincidentes). Esos requisitos están en cada capítulo del manual.

## Notificaciones por capacidad

Algunos avisos se envían a **todos los usuarios activos que tengan una capacidad**:

- *Resolver revisiones* → rechazos de asignación y apelaciones.
- *Cerrar partidos* → «Informes listos para cierre».

## Roles vigentes

Este listado se genera en vivo con los roles configurados actualmente (incluidos los personalizados). Pulse un rol para ver sus capacidades.

```futowl-roles
```

Siguiente: [Roles predefinidos](/app/ayuda/roles-predefinidos) · [Catálogo de capacidades](/app/ayuda/catalogo-de-permisos) · [Crear roles y asignar capacidades](/app/ayuda/crear-roles-y-asignar-permisos)
