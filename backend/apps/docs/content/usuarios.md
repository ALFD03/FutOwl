---
title: Usuarios
summary: Crear cuentas, asignar roles y permisos personalizados, restablecer contraseñas y desbloquear
section: manual
order: 240
---
**Ruta:** Administración → Usuarios (`/app/usuarios`) · **Permisos:** `accounts.view_user` (ver), `accounts.add_user` (crear), `accounts.change_user` (editar, desactivar, desbloquear).

## Crear un usuario

**Nuevo usuario**:

| Campo | Notas |
|-------|-------|
| **Usuario** | Nombre para iniciar sesión, único. |
| Correo, nombres, apellidos, teléfono | El teléfono se guarda cifrado. |
| **Contraseña** | Obligatoria al crear (mín. 10 caracteres, no común, no solo números). Al editar, déjela vacía para no cambiarla. |
| Cambio obligatorio | Exige que el usuario cambie la contraseña al entrar (se le muestra el aviso en *Mi cuenta*). |
| **Roles** | Uno o varios. |
| **Permisos** | Permisos adicionales solo para este usuario. Los que ya vienen de los roles elegidos aparecen encendidos y bloqueados (*Por rol*). |

> [!TIP]
> Para delegados, árbitros, entrenadores y gestores de equipo es más práctico crear el usuario **desde su ficha** (sección *Usuario de acceso*): queda vinculado y con el rol correcto en un solo paso.

## Vincular un usuario con su ficha

FutOwl reconoce el papel de una persona en un partido por el **usuario vinculado**:

| Papel | Dónde se vincula |
|-------|------------------|
| Delegado | Registro → Delegados → editar → *Usuario de acceso* |
| Árbitro | Registro → Árbitros → editar → *Usuario de acceso* |
| Entrenador | Registro → Entrenadores → editar → *Usuario de acceso* |
| Gestor de equipo | Registro → Equipos → (equipo) → pestaña **Acceso** |

En **Mi cuenta** el usuario puede comprobar si tiene perfil de delegado/árbitro vinculado y cuántos equipos gestiona.

## Restablecer una contraseña

FutOwl no tiene recuperación automática por correo. Para restablecer:

1. Abra el usuario (lápiz).
2. Escriba una **contraseña temporal** y marque **Cambio obligatorio**.
3. Guarde y comuníquela al usuario por un canal seguro.

## Desbloquear una cuenta

Tras 5 intentos fallidos la cuenta queda bloqueada 15 minutos. Para desbloquearla antes, pulse el ícono del **candado abierto** en la fila del usuario.

## Desactivar

Los usuarios **no se eliminan**: se **desactivan** (ícono de apagado). Un usuario inactivo no puede iniciar sesión ni renovar su sesión, pero su historial (auditoría, eventos, informes) se conserva.

## Auditoría de accesos

Cada cambio de roles o permisos de un usuario queda en la bitácora como `update_access` con los roles antes y después. Vea [Auditoría](/app/ayuda/auditoria) y [Crear roles y asignar permisos](/app/ayuda/crear-roles-y-asignar-permisos).
