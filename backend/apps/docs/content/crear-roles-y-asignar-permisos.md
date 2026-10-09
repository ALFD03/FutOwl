---
title: Crear roles y asignar permisos
summary: Paso a paso para crear un rol, asignarlo y dar permisos personalizados a un usuario
section: permissions
order: 40
---
## Crear o editar un rol

**Ruta:** Administración → Roles y permisos (`/app/roles`) · **Permisos:** `auth.view_group`, `auth.add_group`, `auth.change_group`.

1. Pulse **Nuevo rol** (o elija un rol de la lista para editarlo). La lista muestra cuántos permisos y usuarios tiene cada rol.
2. Escriba el **nombre del rol**.
3. Encienda los permisos. El selector los agrupa por **módulo** y **objeto**, con su nombre en español y su código:
   - **Filtrar por módulo o permiso…**: busca por nombre, código o módulo.
   - **Todo el módulo / Quitar módulo**: marca o desmarca un módulo completo.
   - **Solo ver**: marca solo los permisos de consulta de ese módulo.
   - **Marcar visibles / Quitar visibles**: aplica a lo que muestra el filtro.
   - **Solo consulta**: deja únicamente los permisos de ver de todo el sistema.
4. Pulse **Guardar**. El cambio queda auditado (`update_permissions`) con los permisos agregados y quitados, y el servidor lo aplica **de inmediato** a todos los usuarios con ese rol; sus menús y botones se actualizan cuando recargan la página o vuelven a entrar.

## Asignar roles y permisos a un usuario

**Ruta:** Administración → Usuarios → lápiz del usuario · **Permiso:** `accounts.change_user`.

1. En **Roles**, elija uno o varios.
2. En **Permisos**, los que vienen de los roles aparecen **encendidos y bloqueados** con la marca *Por rol*. Encienda otros para **personalizar** a ese usuario.
3. Guarde. Queda auditado (`update_access`) con los roles antes y después.

## Recetas frecuentes

| Necesidad | Configuración sugerida |
|-----------|------------------------|
| Consulta general sin poder modificar nada | Nuevo rol con **Solo consulta**. |
| Coordinador que arma jornadas sin enviarlas | Consulta + `competition.add_matchday` + `competition.change_match`. |
| Jefe de árbitros que también programa | Rol *Jefe de árbitros* + `competition.change_match`. |
| Mesa técnica central (opera cualquier partido) | Consulta + `competition.operate_any_match`. |
| Secretaría de registro | Todo el módulo **Registro** + `tournaments.add_teamplayer` + `tournaments.change_teamplayer`. |
| Comisión disciplinaria | Consulta + `competition.view_reviewcase` + `competition.resolve_reviewcase` + `competition.add_matchnote`. |
| Auditor externo | `audit.view_auditlog` + `audit.verify_auditlog`. |

## Buenas prácticas

- Prefiera **roles** a permisos personalizados: son más fáciles de revisar y mantener.
- Aplique el **mínimo privilegio**: dé solo lo que la persona necesita para su función.
- `competition.operate_any_match` y `registry.change_team` son permisos **amplios** (actúan sobre cualquier partido o equipo): resérvelos a autoridades.
- Revise periódicamente la columna *Personalizados* del listado de usuarios.
- Recuerde que los permisos no bastan para actuar como delegado, árbitro o gestor: el usuario también debe estar **vinculado** a su ficha o equipo.
