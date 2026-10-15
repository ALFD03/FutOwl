---
title: Fixture y partidos
summary: Generar el calendario automáticamente, crear partidos manuales y entender los estados del partido
section: manual
order: 140
---
## Generar el fixture

**Torneo → Partidos → Generar fixture** (permiso *Armar el fixture*):

| Campo | Descripción |
|-------|-------------|
| **Categoría** | La elegida arriba en la pestaña. |
| Grupo | Vacío = todos los equipos de la categoría; con grupo = solo los de ese grupo. |
| Ida y vuelta | Duplica las fechas invirtiendo local y visitante. Marcado por defecto si la modalidad es *Liga ida y vuelta*, o si se elige un grupo y el torneo tiene la *fase de grupos ida y vuelta*. |

FutOwl usa el **método del círculo**: cada equipo enfrenta a todos los demás una vez (dos con ida y vuelta) y la localía se alterna por fecha. Con un número impar de equipos, en cada fecha uno **descansa**.

| Equipos | Fechas | Partidos (solo ida) |
|---------|--------|---------------------|
| 4 | 3 | 6 |
| 5 | 5 | 10 |
| 6 | 5 | 15 |
| 8 | 7 | 28 |

Reglas:

- Se necesitan **al menos 2 equipos** inscritos y activos.
- Hay **un fixture por categoría/grupo**. Si ya existe, el diálogo lo avisa y ofrece **Reemplazar**: borra ese fixture y lo genera de nuevo (por ejemplo, para pasarlo a ida y vuelta). Solo es posible si **todos** sus partidos siguen en borrador.
- Los partidos se crean en **Borrador** y *Sin jornada*.

## Crear y editar un partido

**Torneo → Partidos → Nuevo partido**: categoría, grupo (opcional), local, visitante y fecha/ronda. Al elegir un grupo, los selectores de equipos muestran solo los de ese grupo, y el visitante no ofrece al equipo ya elegido como local. Útil para partidos extra o desempates; los cruces de la eliminación directa los crea su llave.

El ícono de **lápiz** de un partido en **Borrador** abre el mismo formulario para cambiar local, visitante, fecha/ronda o grupo. La cancha, el horario y los oficiales se asignan en la **jornada**. Los partidos ya enviados muestran un **candado**: se cambian con un *ajuste* desde su ficha.

## Listado de partidos

- En el torneo, la pestaña **Partidos** los agrupa por **Fecha** (y luego por ronda de la llave) con su grupo, jornada, horario, cancha, marcador y estado, de 20 en 20. Arriba se filtra por **equipo**, **estado** (*Borrador*, *Enviados*, *Jugados*) y **fase**: cada grupo y cada ronda de la eliminación directa (*32avos*, *16avos*, *Octavos*, *Cuartos*, *Semifinal*, *Final*). Un partido de grupos generado sin grupo se ubica por el grupo de sus equipos. Hay contadores de partidos, borradores y partidos sin jornada.
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

Los partidos en **Borrador** de la fase regular se eliminan **definitivamente** desde la pestaña **Partidos** (capacidad *Armar el fixture*), siempre con confirmación:

- Uno: ícono de **papelera** del partido.
- Varios: marque sus casillas (o *Seleccionar los N borradores del filtro*) y pulse **Eliminar**. Los que no estén en borrador se omiten.

Los partidos de la eliminación directa no se borran sueltos: se reemplazan con **Rehacer llave**. Para solo quitar un partido de una jornada en borrador use la **X** de su tarjeta. Una vez enviados, los partidos se **suspenden**, no se eliminan.
