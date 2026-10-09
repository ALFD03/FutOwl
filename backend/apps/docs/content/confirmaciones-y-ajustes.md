---
title: Confirmaciones, ajustes y suspensiones
summary: Confirmar o rechazar asignaciones, ajustar partidos enviados con exposición de motivos y suspender
section: manual
order: 160
---
## Confirmar o rechazar una asignación

**Dónde:** ficha del partido → **Resumen y confirmaciones** → panel *Confirmaciones de asistencia* (o desde **Mis asignaciones → Por confirmar**).
**Permiso:** `competition.confirm_assignment` y **ser la parte asignada** (usuario vinculado al delegado/árbitro, o gestor del equipo).

El panel lista cada parte con su estado (*Pendiente*, *Confirmado*, *Rechazado*, *En revisión*):

| Parte | ¿Obligatoria? |
|-------|---------------|
| Delegado | Sí |
| Árbitro principal / Asistente 1 / Asistente 2 | Sí, según los árbitros exigidos por el torneo |
| Equipo local / Equipo visitante | **Opcional** (deseable) |

En su fila verá los botones:

- **Confirmar**: su asistencia queda registrada y **bloqueada** (no puede cambiarla).
- **Rechazar**: debe escribir el **motivo** (mínimo 5 caracteres). El rechazo crea un **caso en revisión** y se notifica a las autoridades.

Cuando el delegado y toda la terna exigida confirman, el partido pasa a **Confirmado**, se notifica a todos que *se llevará a cabo* y se publica en el sitio. Al desplegar *Historial completo* verá todas las respuestas con fecha, usuario y versión.

> [!NOTE]
> Solo se puede responder mientras el partido está *Pendiente* o *Confirmado*. Si su rechazo está en revisión, debe esperar la resolución.

## Qué pasa con un rechazo

1. Se abre un caso de tipo *Rechazo de asignación* en **Competición → Revisiones**.
2. La autoridad puede:
   - **Reasignar** con un **ajuste** (por ejemplo, otro árbitro) y luego **resolver** el caso, o
   - **Desestimar** el rechazo: la parte puede **volver a responder**.
3. Quien rechazó recibe una notificación con la resolución.

Vea [Notas, apelaciones y revisiones](/app/ayuda/notas-apelaciones-y-revisiones).

## Ajustes con exposición de motivos

**Dónde:** ficha del partido → **Ajustar** (solo si el partido está *Pendiente* o *Confirmado*, es decir, enviado y no iniciado).
**Permiso:** `competition.adjust_match`.

Campos ajustables: **cancha, inicio, fin, delegado, árbitro principal, asistentes**. Escriba la **exposición de motivos** (mínimo 10 caracteres) y pulse **Registrar ajuste**.

FutOwl:

1. Guarda el **antes y el después** de cada campo, el motivo, el usuario y la fecha. **Nada se sobrescribe**: el historial se ve en *Historial de ajustes*.
2. Valida de nuevo capacidad de cancha y solapamientos.
3. Sube la **versión de asignación** (v1 → v2…).
4. Determina las **partes afectadas**, que deben **volver a confirmar**:
   - Cambio de cancha u horario → **todos** (oficiales y equipos).
   - Cambio de un oficial → solo esa posición.
5. Si afecta a algún oficial, el partido vuelve a **Pendiente** (y la jornada a *Enviada*).
6. Notifica a todos los involucrados con el motivo.

> [!TIP]
> Ejemplo: el árbitro *Pedro Gil* rechaza por enfermedad. La autoridad abre el partido → **Ajustar** → Árbitro principal: *Ana Ruiz* → motivo *«Reemplazo por rechazo justificado de P. Gil (enfermedad)»*. Ana recibe la notificación y debe confirmar; el resto de la terna conserva su confirmación.

## Suspender un partido

**Dónde:** ficha del partido → **Suspender** (partidos enviados que no estén cerrados ni suspendidos). **Permiso:** `competition.suspend_match`.

Requiere **exposición de motivos** (mínimo 10 caracteres). El partido pasa a **Suspendido**, se registra el estado anterior y el motivo, y se notifica a los involucrados. Un partido suspendido:

- Libera la cancha y los oficiales para otros partidos en ese horario.
- Cuenta como resuelto para poder **cerrar la jornada**.
- No suma a la tabla de posiciones.

Para reprogramarlo, cree un **partido manual** con los mismos equipos y agréguelo a otra jornada.
