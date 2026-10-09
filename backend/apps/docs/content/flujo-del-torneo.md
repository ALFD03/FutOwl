---
title: El flujo completo de un torneo
summary: Guía paso a paso, de la creación del torneo al cierre de la jornada, con un ejemplo real
section: manual
order: 50
---
Este capítulo recorre **todo el ciclo** con un ejemplo. Cada paso enlaza al capítulo con el detalle.

> [!TIP]
> **Ejemplo que usaremos**: la *Copa Apertura 2026*, categoría **Sub 12**, con 4 equipos (Águilas FC, Leones del Este, Halcones y Toros), jugada en la *Cancha Municipal* (divisible en 2 mini canchas), liga todos contra todos.

## Mapa del proceso

| # | Paso | Quién lo hace | Resultado |
|---|------|---------------|-----------|
| 0 | Preparar el registro | Autoridad / administrador | Categorías, canchas, delegados, árbitros y equipos creados. |
| 1 | Crear el torneo | Autoridad | Torneo con reglas y categorías. |
| 2 | Inscribir equipos y cargar nóminas | Autoridad + gestores | Equipos inscritos; jugadores en la nómina del torneo. |
| 3 | Generar el fixture | Autoridad | Partidos en *borrador* organizados por fecha. |
| 4 | Armar la jornada | Autoridad / jefes de delegados y árbitros | Partidos con cancha, horario, delegado y terna. |
| 5 | Enviar la jornada | Autoridad | Asignaciones bloqueadas; oficiales y equipos notificados. |
| 6 | Confirmar asistencia | Delegado, árbitros (y equipos) | Partido *confirmado* cuando confirman todos los oficiales. |
| 7 | Cargar alineaciones | Gestores / entrenadores | Alineación de cada equipo lista antes del partido. |
| 8 | Operar la mesa técnica | Delegado asignado | Cronología en vivo; resultado público en tiempo real. |
| 9 | Enviar informes | Delegado y árbitro principal | Dos informes que deben coincidir. |
| 10 | Cerrar el partido | Autoridad | Resultado oficial e inalterable; posiciones actualizadas. |
| 11 | Cerrar la jornada | Autoridad | Jornada cerrada; solo notas o apelaciones. |

## Paso 0 — Preparar el registro

Antes del torneo deben existir:

1. **Categorías**: *Sub 12* con tope de edad 11 → en 2026 admite nacidos desde 2015. [Ver Categorías](/app/ayuda/categorias).
2. **Canchas**: *Cancha Municipal*, divisible, 2 mini canchas → admite 2 partidos simultáneos. [Ver Canchas](/app/ayuda/canchas).
3. **Delegados y árbitros**, cada uno con su **usuario de acceso** para poder confirmar y operar. [Ver Delegados y árbitros](/app/ayuda/delegados-y-arbitros).
4. **Equipos** con su gestor (usuario), sus **categorías** (Sub 12) y su cuerpo técnico. [Ver Equipos](/app/ayuda/equipos).

## Paso 1 — Crear el torneo

**Competición → Torneos → Nuevo torneo**:

- Nombre: *Copa Apertura 2026*; modalidad *Liga (todos contra todos)*; estado *Inscripciones*.
- Categorías permitidas: *Sub 12*; canchas: *Cancha Municipal*.
- Reglas: 60 min, 2 tiempos, 10 min de descanso, 5 cambios, 18 jugadores por planilla, 11 titulares, 3 árbitros.
- Puntuación: 3 / 1 / 0.

[Detalle en Torneos](/app/ayuda/torneos).

## Paso 2 — Inscribir equipos y cargar nóminas

1. En el torneo, pestaña **Equipos y grupos → Inscribir equipo**: elija la categoría *Sub 12* y el equipo. Repita para los 4.
2. Cada **gestor** entra a su equipo (**Registro → Equipos →** su equipo) → pestaña **Nómina por torneo**, elige *Copa Apertura 2026 · Sub 12* e **inscribe a sus jugadores** con su dorsal. FutOwl solo ofrece jugadores nacidos desde 2015 y que no estén ya en otro equipo de ese torneo.

[Detalle en Inscripciones, grupos y nómina](/app/ayuda/inscripciones-grupos-y-nomina).

## Paso 3 — Generar el fixture

En el torneo, pestaña **Partidos → Generar fixture** (categoría *Sub 12*). Con 4 equipos se crean **6 partidos en 3 fechas** (cada equipo juega una vez por fecha). Todos quedan en **Borrador** y *Sin jornada*. [Detalle en Fixture y partidos](/app/ayuda/fixture-y-partidos).

## Paso 4 — Armar la jornada

1. **Competición → Jornadas → Jornada**: número 1, día *sábado 14/03/2026*.
2. En la jornada, **Agregar partidos** y marque los dos partidos de la *Fecha 1*.
3. Para cada partido complete **cancha, hora de inicio, delegado, árbitro principal y asistentes** y pulse **Guardar**. FutOwl calcula la hora de fin (60 + 10 = 70 min), asigna la mini cancha libre y valida que no haya choques.

Ejemplo: *Águilas vs Toros* a las 08:00 en mini cancha 1 y *Leones vs Halcones* a las 08:00 en mini cancha 2 → válido (la cancha admite 2). Un tercer partido a las 08:30 en la misma cancha sería rechazado.

La jornada sigue en **Borrador** mientras falte algún dato; un aviso indica qué falta. [Detalle en Jornadas](/app/ayuda/jornadas).

## Paso 5 — Enviar la jornada

Con todo completo aparece **Jornada completa** y se habilita **Enviar jornada**. Al enviarla:

- Los partidos pasan a **Pendiente de confirmación** y sus asignaciones quedan **bloqueadas**.
- Se **notifica** a delegados, árbitros y gestores.
- Desde aquí, cualquier cambio exige un **ajuste con exposición de motivos**.

## Paso 6 — Confirmar asistencia

Cada oficial abre **Mis asignaciones → Por confirmar** → partido → **Confirmar** (o **Rechazar** indicando el motivo).

- Cuando confirman el **delegado y toda la terna exigida**, el partido pasa a **Confirmado** y se publica en el sitio.
- Cuando todos los partidos de la jornada están confirmados, la jornada pasa a **Válida**.
- Un **rechazo** abre un caso en **Revisiones** para que la autoridad reasigne (ajuste) o desestime.

[Detalle en Confirmaciones y ajustes](/app/ayuda/confirmaciones-y-ajustes).

## Paso 7 — Cargar alineaciones

Antes del partido, el gestor o entrenador abre el partido → **Alineaciones**, marca convocados, dorsales, titulares y capitán (o **importa la planilla** .docx/.csv) y pulsa **Cargar alineación**. [Detalle en Alineaciones](/app/ayuda/alineaciones).

## Paso 8 — Mesa técnica

El día del partido, el delegado abre el partido (entra directo a **Mesa técnica**) y sigue el protocolo: **llegada del delegado → llegada de cada equipo → verificación de documentos → Iniciar partido**. Durante el juego registra goles, tarjetas, cambios, fin de cada tiempo y **Fin del partido**. [Detalle en Mesa técnica](/app/ayuda/mesa-tecnica).

## Paso 9 — Informes

Al finalizar, delegado y árbitro principal envían su informe en **Informes y cierre** (marcador y tarjetas de cada equipo). FutOwl los compara entre sí y con la cronología.

## Paso 10 — Cierre del partido

Si los informes **coinciden**, la autoridad pulsa **Cerrar partido**: el resultado queda **oficial** y se actualizan las posiciones. Si no coinciden, devuelve el informe equivocado para corrección. [Detalle en Informes y cierre](/app/ayuda/informes-y-cierre).

## Paso 11 — Cierre de la jornada

Con todos los partidos **cerrados o suspendidos**, la autoridad pulsa **Cerrar jornada**. Después solo se admiten **notas o apelaciones**. Repita desde el paso 4 para la siguiente fecha.
