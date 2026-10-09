---
title: Informes y cierre del partido
summary: Informe del delegado y del árbitro, comparación, devolución para corrección y cierre oficial
section: manual
order: 190
---
**Dónde:** ficha del partido → **Informes y cierre** (visible con el partido *Finalizado* o *Cerrado*).

## 1. Enviar el informe

**Quién:** el **delegado asignado** (permiso `competition.submit_delegate_report`) y el **árbitro principal** (permiso `competition.submit_referee_report`). Cada uno ve el formulario en su tarjeta.

Datos del informe:

| Campo | Descripción |
|-------|-------------|
| Goles local / visitante | Marcador final. |
| Amarillas local / visitante | Total de tarjetas amarillas por equipo. |
| Rojas local / visitante | Total de rojas por equipo (incluidas las de doble amarilla). |
| Observaciones | Texto libre. |
| Adjunto | PDF o imagen (opcional): acta escaneada, por ejemplo. |

Pulse **Enviar informe**. Una vez enviado **no puede modificarse**, salvo que una autoridad lo **devuelva**.

> [!NOTE]
> Solo se puede enviar con el partido **Finalizado** (después de *Fin del partido* y antes del cierre).

## 2. Comparación automática

La tabla **Comparación** muestra, para cada dato, la **cronología** de la mesa técnica, el **informe del delegado** y el **informe arbitral**. Las filas que no coinciden se resaltan en rojo y arriba aparece *Coinciden* o *No coinciden*. Si un informe difiere de la cronología, se muestra una advertencia.

Cuando ambos informes están enviados, FutOwl notifica a quienes pueden cerrar partidos.

## 3. Devolver un informe

**Quién:** permiso `competition.return_report` (autoridades, jefes de delegados o de árbitros).

Botón **Devolver** en la tarjeta del informe → escriba el motivo (mínimo 5 caracteres). El informe actual **se conserva** en el historial marcado como devuelto, el autor recibe una notificación y vuelve a ver el formulario para enviar una **nueva versión** (v2, v3…). El historial de versiones muestra quién devolvió y por qué.

## 4. Cerrar el partido

**Quién:** permiso `competition.close_match`.

El botón **Cerrar partido** se habilita cuando **ambos informes vigentes coinciden** en marcador y tarjetas. Al cerrar:

- Se crea el **cierre oficial** con el resultado del informe y referencias a ambos informes.
- El partido pasa a **Cerrado**; el marcador queda **oficial e inalterable**.
- La **tabla de posiciones** oficial lo incluye.
- Se notifica a todos los involucrados.

Después del cierre solo se admiten **notas o apelaciones**.

## Ejemplo de discrepancia

El delegado informa 2-1 y 3 amarillas para el local; el árbitro, 2-1 y 4 amarillas. La comparación marca *Amarillas local* en rojo y la cronología muestra 4. La autoridad **devuelve** el informe del delegado con el motivo «La cronología registra 4 amarillas del local», el delegado envía la v2 con 4 y la autoridad cierra.
