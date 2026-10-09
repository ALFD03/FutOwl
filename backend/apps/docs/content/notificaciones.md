---
title: Notificaciones
summary: Avisos automáticos que recibe cada usuario y cómo gestionarlos
section: manual
order: 230
---
**Dónde:** campana del encabezado (contador de no leídas, se actualiza cada 30 s) y **Notificaciones** (`/app/notificaciones`).

Cada usuario ve **solo sus propias notificaciones**. Pulse una para ir a la pantalla relacionada. En la página de notificaciones, el interruptor **Solo no leídas** filtra la lista y **Marcar todas** limpia el contador.

## Cuándo se envían

| Evento | Destinatarios | Nivel |
|--------|---------------|-------|
| Jornada enviada: *Nueva asignación pendiente de confirmación* | Delegado, árbitros y gestores de ambos equipos de cada partido | Advertencia |
| Partido confirmado: *se llevará a cabo el …* | Todos los involucrados del partido | Éxito |
| Jornada válida | Todos los involucrados de la jornada | Éxito |
| Rechazo de asignación en revisión | Usuarios con permiso para resolver revisiones | Peligro |
| Ajuste en partido asignado (con el motivo) | Todos los involucrados | Advertencia |
| Partido suspendido (con el motivo) | Todos los involucrados | Peligro |
| Partido finalizado: delegado y árbitro deben enviar informes | Todos los involucrados | Información |
| Informes listos para cierre | Usuarios con permiso para cerrar partidos | Información |
| Informe devuelto para corrección | Autor del informe | Advertencia |
| Partido cerrado con el resultado oficial | Todos los involucrados | Éxito |
| Nueva apelación | Usuarios con permiso para resolver revisiones | Peligro |
| Caso resuelto o desestimado | Quien presentó el caso | Información |

«Involucrados» son los usuarios vinculados al delegado y a la terna exigida, más los **gestores** de los dos equipos. Los superusuarios reciben también las notificaciones dirigidas a un permiso.

> [!NOTE]
> Las notificaciones solo se muestran dentro de FutOwl; no se envían por correo ni SMS.
