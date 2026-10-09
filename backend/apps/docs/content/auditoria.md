---
title: Auditoría
summary: La bitácora inalterable, qué registra, cómo consultarla y verificar su integridad
section: manual
order: 250
---
**Ruta:** Administración → Auditoría (`/app/auditoria`) · **Permisos:** `audit.view_auditlog` para consultar, `audit.verify_auditlog` para verificar la integridad.

## Qué registra

Cada asiento guarda **usuario, acción, objeto afectado, cambios (antes/después), IP, navegador, ruta y hora**. Se registran, entre otras:

| Acción | Cuándo |
|--------|--------|
| `create` / `update` | Alta o modificación de cualquier registro (con el detalle de los campos cambiados). |
| `activate` / `deactivate` / `delete` | Reactivación, desactivación o eliminación de borradores. |
| `login` / `login_failed` / `login_blocked` / `logout` | Accesos. |
| `password_change` / `unlock` / `update_access` / `update_permissions` | Seguridad de cuentas y roles. |
| `accept_terms` | Aceptación de términos. |
| `submit_matchday` / `matchday_confirmed` / `close_matchday` | Jornadas. |
| `confirmation_accepted` / `confirmation_rejected` | Respuestas a asignaciones. |
| `generate_fixture` / `submit_lineup` / `match_event` | Fixture, alineaciones y cada evento de mesa técnica. |
| `close_match` / `suspend_match` | Cierre y suspensión. |
| `export_document` | Exportación de planillas. |

Los datos sensibles (cédulas, teléfonos, contraseñas) aparecen como `***cifrado***`.

## Consultar

Busque por usuario, objeto o acción y filtre por tipo de acción. Pulse un registro para ver el detalle completo y el JSON de cambios.

## Verificar la integridad

Cada asiento incluye el **hash SHA-256** del asiento anterior, formando una cadena. **Verificar integridad** recalcula toda la cadena:

- *Cadena íntegra*: N registros verificados sin alteraciones.
- *¡Integridad comprometida!*: indica el primer registro alterado (por ejemplo, si alguien modificó la base de datos directamente).

> [!IMPORTANT]
> La bitácora es de **solo inserción**: en PostgreSQL un trigger impide modificar o borrar asientos incluso con SQL directo.
