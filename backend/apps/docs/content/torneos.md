---
title: Torneos
summary: Crear un torneo, su puntuación, reglas de juego por categoría, estados y pestañas de la ficha
section: manual
order: 120
---
**Ruta:** Competición → Torneos (`/app/torneos`) · **Capacidades:** *Consultar torneos y partidos* para ver; *Gestionar torneos* para crear, editar, cambiar estado, reglas, reglamento y desactivar.

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
| Puntuación | Puntos por victoria / empate / derrota | 3 / 1 / 0. |
| Documentación (importar) | Reglamento, plantilla de planilla de alineación, plantilla de tarjeta de cambio | Archivos Word/PDF propios del torneo. |

Las **reglas de juego** no se piden al crear el torneo: se configuran después, dentro del torneo, en la pestaña **Reglas de juego**.

## Reglas de juego

Las reglas de juego son de cada **categoría** (Registro → Categorías): todos los torneos las usan tal cual. En la pestaña **Reglas de juego** de la ficha del torneo:

- Cada fila es una categoría del torneo con las reglas que se aplican.
- **Ajustar para este torneo** cambia las reglas de esa categoría **solo en este torneo** (parte de las de la categoría); la categoría no se modifica.
- **Usar las de la categoría** quita el ajuste y vuelve a las reglas de la categoría (*Gestionar torneos*).

| Regla | Valor por defecto / notas |
|-------|---------------------------|
| Duración del partido (min) | 60 (entre 10 y 150). |
| Tiempos | 2 (de 1 a 4). |
| Descanso (min) | 10. |
| Cambios máximos | Vacío = ilimitados. |
| Jugadores por planilla | 18. |
| Titulares | 11 (no puede superar los jugadores por planilla). |
| Árbitros requeridos | 3 = terna completa; 2 = principal + asistente 1; 1 = solo principal. |

## Cómo influyen las reglas

Cada partido usa las reglas de **su categoría**, con el ajuste del torneo si lo tiene.

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
| **Reglas de juego** | Reglas de cada categoría y su ajuste para este torneo. | — |
| **Equipos y grupos** | Inscripciones por categoría y grupos. | [Inscripciones, grupos y nómina](/app/ayuda/inscripciones-grupos-y-nomina) |
| **Partidos** | Fixture por fecha; generar o crear partidos. | [Fixture y partidos](/app/ayuda/fixture-y-partidos) |
| **Jornadas** | Jornadas del torneo. | [Jornadas](/app/ayuda/jornadas) |
| **Documentación** | Exportar planilla, tarjetas de cambio y reglamento; editar el reglamento. | [Documentos del torneo](/app/ayuda/documentos-del-torneo) |
| **Posiciones** | Tabla por categoría y grupo. | [Posiciones y estadísticas](/app/ayuda/posiciones-y-estadisticas) |

> [!NOTE]
> Los torneos no se eliminan: se **desactivan** desde el listado. Un torneo desactivado deja de verse en el sitio público.
