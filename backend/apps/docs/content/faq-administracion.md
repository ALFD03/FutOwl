---
title: "FAQ: administración"
summary: Usuarios, roles, permisos, accesos de equipos, términos, auditoría y documentación
section: faq
order: 80
---
### ¿Cómo doy acceso al gestor de un equipo?

**Registro → Equipos → (equipo) → Acceso → Agregar usuario**: vincule un usuario existente o cree uno. Recibe el rol *Gestor de equipo* y podrá cargar nómina y alineaciones y confirmar la asistencia del equipo.

### ¿Cómo hago para que un delegado pueda operar la mesa técnica?

1. El delegado debe tener **usuario vinculado** en su ficha (Registro → Delegados → editar → *Usuario de acceso*).
2. Ese usuario debe tener el rol **Delegado** (o el permiso `competition.operate_match`).
3. Debe estar **asignado** al partido.

### Quiero que una persona opere la mesa técnica de cualquier partido (por ejemplo, una autoridad de apoyo)

Asígnele el permiso `competition.operate_any_match` (directamente o mediante un rol). Úselo con cuidado: también permite cargar alineaciones de cualquier equipo.

### ¿Cómo creo un rol nuevo?

**Administración → Roles y permisos → Nuevo rol**, escriba el nombre, encienda los permisos y **Guardar**. Paso a paso en [Crear roles y asignar permisos](/app/ayuda/crear-roles-y-asignar-permisos).

### Necesito darle a una sola persona un permiso extra

Edite el usuario en **Administración → Usuarios** y, en *Permisos*, encienda el permiso adicional. Los permisos de sus roles aparecen bloqueados como *Por rol*.

### Los jefes de delegados o de árbitros no pueden programar partidos

Para editar cancha, horario y oficiales en una jornada se necesita `competition.change_match`, que esos roles no traen por defecto. Agrégueselo al rol o a los usuarios que lo necesiten.

### Una autoridad no puede editar usuarios / cargar los permisos

El rol *Autoridad* solo **ve** usuarios. Editar usuarios requiere `accounts.change_user` y el selector de permisos necesita poder consultar el catálogo de permisos, que por defecto solo tiene el *Administrador*.

### Restaurar los permisos originales de los roles predefinidos

Un técnico puede ejecutar `python manage.py seed_roles` (o `make roles`): vuelve a dejar los roles predefinidos con sus permisos por defecto. **No** afecta los roles personalizados ni los permisos individuales de los usuarios.

### Publicar nuevos términos y condiciones

**Administración → Términos**: versión nueva, contenido y **Publicar**. Todos los usuarios deberán aceptarlos. Vea [Términos y condiciones](/app/ayuda/terminos-y-condiciones).

### La verificación de auditoría dice «Integridad comprometida»

Alguien modificó la base de datos fuera de FutOwl. Anote el número de registro indicado, no haga cambios y avise al responsable técnico para investigar con las copias de seguridad.

### ¿Quién puede editar esta documentación?

Solo el **superusuario**. Verá los botones **Editar**, **Publicar/Despublicar** y **Nueva página**. Vea [Cómo editar la documentación](/app/ayuda/editar-documentacion).
