---
title: Torneos
summary: Crear un torneo, sus reglas de juego, puntuación, estados y pestañas de la ficha
section: manual
order: 120
---
**Ruta:** Competición → Torneos (`/app/torneos`) · **Permisos:** `tournaments.view_tournament` para ver; `tournaments.add_tournament` para crear; `tournaments.change_tournament` para editar, cambiar estado, guardar el reglamento y desactivar.

## Crear un torneo

Botón **Nuevo torneo**:

| Sección | Campo | Valor por defecto / notas |
|---------|-------|---------------------------|
| General | **Nombre** (único), logo | |
| | **Modalidad** | Liga (todos contra todos), Liga ida y vuelta, Fase de grupos, Grupos + eliminación directa, Eliminación directa. |
| | **Estado** | *Borrador (no público)*, *Inscripciones*, *En curso*, *Finalizado*. |
| | Fechas de inicio y fin | La de fin no puede ser anterior a la de inicio. |
| | **Categorías permitidas** | Al menos una. |
| | Canchas disponibles (tentativas) | Referencia para programar. |
| Reglas de juego | Duración del partido (min) | 60 (entre 10 y 150). |
| | Tiempos | 2 (de 1 a 4). |
| | Descanso (min) | 10. |
| | Cambios máximos | Vacío = ilimitados. |
| | Jugadores por planilla | 18. |
| | Titulares | 11 (no puede superar los jugadores por planilla). |
| | Árbitros requeridos | 3 = terna completa; 2 = principal + asistente 1; 1 = solo principal. |
| Puntuación | Puntos por victoria / empate / derrota | 3 / 1 / 0. |
| Documentación (importar) | Reglamento, plantilla de planilla de alineación, plantilla de tarjeta de cambio | Archivos Word/PDF propios del torneo. |

## Cómo influyen las reglas

| Regla | Dónde se aplica |
|-------|-----------------|
| Duración, tiempos y descanso | Hora de fin automática al programar: `inicio + duración + descanso × (tiempos − 1)`. Ej.: 60 + 10 = 70 min. También el minuto que muestra la mesa técnica. |
| Tiempos | La mesa técnica no permite iniciar más tiempos que los definidos. |
| Cambios máximos | La mesa técnica rechaza el cambio que supere el límite. |
| Jugadores por planilla / titulares | Límite de convocados y titulares al cargar la alineación. |
| Árbitros requeridos | Campos obligatorios de la jornada y quiénes deben confirmar. |
| Puntuación | Tabla de posiciones. |
| Ida y vuelta | Valor por defecto del generador de fixture. |

## Estados del torneo

| Estado | Efecto |
|--------|--------|
| **Borrador** | No aparece en el sitio público. |
| **Inscripciones** / **En curso** | Visible en el sitio público. |
| **Finalizado** | Visible; **su nómina ya no se modifica** y sus entrenadores quedan libres para dirigir en otros torneos. |

El estado se cambia con **Editar** en el encabezado del torneo.

## La ficha del torneo

| Pestaña | Contenido | Capítulo |
|---------|-----------|----------|
| **Resumen** | Configuración y el flujo del torneo en 8 pasos. | — |
| **Equipos y grupos** | Inscripciones por categoría y grupos. | [Inscripciones, grupos y nómina](/app/ayuda/inscripciones-grupos-y-nomina) |
| **Partidos** | Fixture por fecha; generar o crear partidos. | [Fixture y partidos](/app/ayuda/fixture-y-partidos) |
| **Jornadas** | Jornadas del torneo. | [Jornadas](/app/ayuda/jornadas) |
| **Documentación** | Exportar planilla, tarjetas de cambio y reglamento; editar el reglamento. | [Documentos del torneo](/app/ayuda/documentos-del-torneo) |
| **Posiciones** | Tabla por categoría y grupo. | [Posiciones y estadísticas](/app/ayuda/posiciones-y-estadisticas) |

> [!NOTE]
> Los torneos no se eliminan: se **desactivan** desde el listado. Un torneo desactivado deja de verse en el sitio público.
