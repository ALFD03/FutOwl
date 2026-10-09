---
title: "FAQ: confirmaciones y ajustes"
summary: Asignaciones que no aparecen, botones de confirmar, rechazos, reasignaciones y cambios de horario
section: faq
order: 50
---
### No veo mis partidos en Mis asignaciones

Un partido es suyo solo si su **usuario** está vinculado a la ficha del oficial asignado o es **gestor** (o entrenador vinculado) de uno de los equipos. Verifique en **Mi cuenta** si tiene *Perfil de delegado/árbitro vinculado* y *Equipos que gestiona*. Si no, pida a un administrador que lo vincule. Recuerde además que los partidos solo pasan a *Por confirmar* cuando la jornada se **envía**.

### No me aparece el botón «Confirmar»

Revise que:

1. El partido esté **Pendiente** o **Confirmado** (no en borrador).
2. Usted sea la **parte asignada** (su fila del panel debe corresponder a su posición).
3. Tenga el permiso `competition.confirm_assignment`.
4. No haya confirmado ya (la confirmación queda bloqueada) ni tenga un rechazo **en revisión**.

### Confirmé por error / ya no puedo asistir

La confirmación no se puede retirar. Avise a la autoridad: deberá hacer un **ajuste** reasignando su posición (con exposición de motivos) o suspender el partido.

### Un árbitro rechazó, ¿cómo lo reemplazo?

1. **Competición → Revisiones**, abra el caso para ver el motivo.
2. En el partido, **Ajustar** → cambie el árbitro → motivo → **Registrar ajuste**. El nuevo árbitro recibe la notificación y debe confirmar.
3. Vuelva al caso y pulse **Resolver** describiendo la reasignación.

### El rechazo no procede, ¿qué hago?

En **Revisiones**, abra el caso y pulse **Desestimar** con la resolución. La parte podrá volver a responder (confirmar) su asignación.

### El partido sigue «Pendiente» aunque el delegado confirmó

Faltan confirmaciones de **la terna exigida** por el torneo (principal y, según la regla, asistentes). La confirmación de los **equipos es opcional** y no bloquea.

### Necesito cambiar la hora o la cancha de un partido ya enviado

**Ajustar** en la ficha del partido (permiso `competition.adjust_match`), solo antes de que inicie. Al cambiar cancha u horario **todos** (oficiales y equipos) deben volver a confirmar y el partido vuelve a *Pendiente*.

### «Solo se pueden ajustar partidos pendientes o confirmados que no hayan iniciado»

El partido ya está en juego, finalizado, cerrado o suspendido. Ya no admite ajustes; use **notas o apelaciones**.

### «No hay cambios que registrar»

Los valores del ajuste son iguales a los actuales. Modifique al menos un campo.

### El partido no se jugará

Use **Suspender** con la exposición de motivos. Para jugarlo otro día, cree un partido manual con los mismos equipos en otra jornada.
