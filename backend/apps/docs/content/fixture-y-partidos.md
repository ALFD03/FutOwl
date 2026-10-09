---
title: Fixture y partidos
summary: Generar el calendario automáticamente, crear partidos manuales y entender los estados del partido
section: manual
order: 140
---
## Generar el fixture

**Torneo → Partidos → Generar fixture** (permiso `competition.generate_fixture`):

| Campo | Descripción |
|-------|-------------|
| **Categoría** | Categoría a programar. |
| Grupo | Vacío = todos los equipos de la categoría; con grupo = solo los de ese grupo. |
| Ida y vuelta | Duplica las fechas invirtiendo local y visitante. Marcado por defecto si la modalidad es *Liga ida y vuelta*. |

FutOwl usa el **método del círculo**: cada equipo enfrenta a todos los demás una vez (dos con ida y vuelta) y la localía se alterna por fecha. Con un número impar de equipos, en cada fecha uno **descansa**.

| Equipos | Fechas | Partidos (solo ida) |
|---------|--------|---------------------|
| 4 | 3 | 6 |
| 5 | 5 | 10 |
| 6 | 5 | 15 |
| 8 | 7 | 28 |

Reglas:

- Se necesitan **al menos 2 equipos** inscritos y activos.
- Solo se genera **una vez por categoría/grupo**: si ya hay partidos, aparece *«Ya existe un fixture para esta categoría/grupo»*.
- Los partidos se crean en **Borrador** y *Sin jornada*.

## Crear un partido manual

**Torneo → Partidos → + Partido** (permiso `competition.add_match`): local, visitante, fecha/ronda y grupo. Útil para partidos extra, desempates o eliminación directa. Ambos equipos deben ser del mismo torneo y categoría, y un equipo no puede jugar contra sí mismo.

## Listado de partidos

- En el torneo, la pestaña **Partidos** los agrupa por **Fecha** con su grupo, jornada, horario, marcador y estado.
- **Competición → Partidos** (`/app/partidos`) lista todos los partidos del sistema con buscador por equipo y filtros por torneo y estado. Se refresca cada 15 s.

## Estados del partido

| Estado | Significado | Cómo se llega |
|--------|-------------|---------------|
| **Borrador** | Editable desde la jornada. | Al crearse. |
| **Pendiente de confirmación** | Asignación bloqueada; esperando a los oficiales. | Al enviar la jornada, o tras un ajuste que afecta a oficiales. |
| **Confirmado** | Delegado y terna confirmaron. Se publica. | Última confirmación de oficiales. |
| **En juego** | Mesa técnica activa. | *Iniciar partido* en la mesa técnica. |
| **Finalizado (informes pendientes)** | Terminó; faltan informes o cierre. | *Fin del partido*. |
| **Cerrado** | Resultado oficial e inalterable. | La autoridad cierra con informes coincidentes. |
| **Suspendido** | Anulado con exposición de motivos. | Acción *Suspender*. |

## La ficha del partido

Marcador (en vivo mientras se juega) y pestañas:

| Pestaña | Visible | Contenido |
|---------|---------|-----------|
| **Resumen y confirmaciones** | Siempre | Asignación, historial de ajustes, confirmaciones; botones *Ajustar*, *Suspender*, *Vista pública*. |
| **Alineaciones** | Siempre | Alineación de local y visitante; exportar planilla. |
| **Mesa técnica** | Desde *Confirmado* | Consola del delegado o cronología. |
| **Informes y cierre** | *Finalizado* o *Cerrado* | Informes, comparación y cierre. |
| **Notas y apelaciones** | Siempre | Notas permanentes. |

Si usted es el delegado del partido, la ficha se abre directamente en **Mesa técnica** cuando el partido está confirmado o en juego.

## Eliminar un partido

Solo los partidos en **Borrador** pueden eliminarse, y únicamente a través de la API (permiso `competition.delete_match`); la interfaz no ofrece ese botón. Para quitar un partido de una jornada en borrador use la **X** de su tarjeta. Una vez enviados, los partidos se **suspenden**, no se eliminan.
