---
title: Crear roles y asignar capacidades
summary: Paso a paso para crear un rol, asignarlo y dar capacidades extra a un usuario
section: permissions
order: 40
---
## Crear o editar un rol

**Ruta:** Administración → Roles y permisos (`/app/roles`) · **Capacidad:** *Gestionar roles*.

1. Pulse **Nuevo rol** (o elija un rol de la lista para editarlo). La lista muestra cuántas capacidades y usuarios tiene cada rol.
2. Escriba el **nombre del rol**.
3. Encienda las **capacidades**. Están agrupadas por área (*Consulta*, *Registro*, *Torneos*, *Programación*, *Día de partido*, *Informes y cierre*, *Administración*) y cada una explica qué permite:
   - **Buscar capacidad…**: filtra por nombre o descripción.
   - **Todas / Quitar todas**: marca o desmarca un área completa.
   - **Marcar visibles / Quitar visibles**: aplica a lo que muestra la búsqueda.
   - **Solo consulta**: deja únicamente *Consultar el registro* y *Consultar torneos y partidos*.
   - Si aparece el aviso de **permisos técnicos antiguos**, pulse **Quitarlos**: son restos de la versión anterior y no habilitan nada.
4. Pulse **Guardar**. El cambio queda auditado (`update_permissions`) y el servidor lo aplica **de inmediato** a todos los usuarios con ese rol; sus menús y botones se actualizan cuando recargan la página o vuelven a entrar.

## Asignar roles y capacidades extra a un usuario

**Ruta:** Administración → Usuarios → lápiz del usuario · **Capacidad:** *Gestionar usuarios*.

1. En **Roles**, elija uno o varios.
2. En **Capacidades extra**, las que vienen de los roles aparecen **encendidas y bloqueadas** con la marca *Por rol*. Encienda otras para **personalizar** a ese usuario.
3. Guarde. Queda auditado (`update_access`) con los roles antes y después.

## Recetas frecuentes

| Necesidad | Capacidades |
|-----------|-------------|
| Consulta general sin poder modificar nada | **Solo consulta**. |
| Coordinador que arma jornadas sin enviarlas | Consulta + *Armar el fixture* + *Programar jornadas y partidos*. |
| Jefe de árbitros que además programa partidos | Rol *Jefe de árbitros* + *Programar jornadas y partidos*. |
| Mesa técnica central (opera cualquier partido) | Consulta + *Mesa técnica de cualquier partido*. |
| Secretaría de registro | Consulta + todas las de **Registro** + *Gestionar nómina*. |
| Comisión disciplinaria | Consulta + *Resolver revisiones* + *Notas y apelaciones*. |
| Auditor externo | *Ver auditoría* + *Verificar auditoría*. |

## Buenas prácticas

- Prefiera **roles** a capacidades extra: son más fáciles de revisar y mantener.
- Aplique el **mínimo privilegio**: dé solo lo que la persona necesita para su función.
- *Mesa técnica de cualquier partido* y *Administrar todos los equipos* son capacidades **amplias** (actúan sobre cualquier partido o equipo): resérvelas a autoridades.
- Recuerde que las capacidades no bastan para actuar como delegado, árbitro o gestor: el usuario también debe estar **vinculado** a su ficha o equipo.
