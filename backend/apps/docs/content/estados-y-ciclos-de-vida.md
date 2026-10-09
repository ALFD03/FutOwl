---
title: Estados y ciclos de vida
summary: Referencia rápida de todos los estados y las transiciones permitidas
section: reference
order: 20
---
## Torneo

`Borrador → Inscripciones → En curso → Finalizado` (se cambia libremente al editar el torneo). Solo *Borrador* es privado; *Finalizado* bloquea la nómina.

## Jornada

| De | A | Disparador |
|----|---|-----------|
| Borrador | Enviada | **Enviar jornada** (todos los partidos completos y sin solapamientos). |
| Enviada | Válida | Automático: todos los partidos confirmados. |
| Válida | Enviada | Automático: un ajuste deja algún partido pendiente. |
| Enviada / Válida | Cerrada | **Cerrar jornada** (todos los partidos cerrados o suspendidos). |
| Borrador | (eliminada) | Papelera; los partidos vuelven al fixture. |

## Partido

| De | A | Disparador |
|----|---|-----------|
| Borrador | Pendiente | Envío de la jornada. |
| Pendiente | Confirmado | Confirmación del delegado y de la terna exigida. |
| Confirmado | Pendiente | Ajuste que afecta a algún oficial. |
| Confirmado | En juego | *Iniciar partido* en la mesa técnica. |
| En juego | Finalizado | *Fin del partido*. |
| Finalizado | Cerrado | **Cerrar partido** con informes coincidentes. |
| Pendiente / Confirmado / En juego / Finalizado | Suspendido | **Suspender** con motivo. |

**Fase** dentro del juego: `Por iniciar → En juego ⇄ Descanso → Terminado`.

## Confirmación de una parte

`Pendiente → Confirmado` (bloqueado) o `Pendiente → Rechazado → En revisión → (Desestimado: puede volver a responder | Resuelto)`. Un ajuste que afecta a la parte exige una nueva confirmación para la nueva versión de asignación.

## Alineación

`Sin cargar → Cargada (editable) → Verificada en mesa técnica (bloqueada)`.

## Informe

`Pendiente → Enviado (v1) → Devuelto → Enviado (v2) …` La versión vigente es la última no devuelta.

## Caso en revisión

`Abierto → Resuelto | Desestimado` (definitivo).

## Registro maestro (equipo, jugador, cancha…)

`Activo ⇄ Inactivo`. Nunca se elimina.

## Página de documentación

`Publicada ⇄ No publicada` (solo superusuario). Cada guardado crea una revisión inalterable.
