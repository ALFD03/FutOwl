---
title: Sitio público
summary: Lo que cualquier visitante ve sin iniciar sesión
section: manual
order: 40
---
El sitio público no requiere cuenta. Sirve para que jugadores, familias y aficionados sigan los torneos.

## Páginas

| Página | Ruta | Contenido | Actualización |
|--------|------|-----------|---------------|
| **Inicio** | `/` | Partidos de hoy y tarjetas de los torneos publicados. | Cada 15 s |
| **En vivo** | `/en-vivo` | *Jugándose ahora*, el resto de partidos de *Hoy* y los *Próximos 7 días* confirmados. | Cada 5 s |
| **Torneo** | `/torneos/<id>` | Pestañas de posiciones (por categoría y grupo), partidos, goleadores y disciplina. | Cada 20 s |
| **Partido** | `/partido/<id>` | Marcador, cronología pública y estadísticas. | Cada 4 s mientras se juega |
| **Términos** | `/terminos` | Términos y condiciones vigentes. | — |

## ¿Qué se publica y qué no?

- **Torneos visibles**: solo los activos en estado *Inscripciones*, *En curso* o *Finalizado*. Un torneo en **Borrador** no aparece en el sitio público.
- **Partidos visibles**: solo los *confirmados*, *en juego*, *finalizados*, *cerrados* o *suspendidos*. Los partidos en borrador o pendientes de confirmación no se publican.
- **Cronología pública**: inicio, tiempos, goles, tarjetas, cambios, fin y anulaciones. **No** se publican la llegada del delegado o de los equipos, la verificación de documentos, las incidencias ni las notas internas.
- **Datos personales**: nunca se publican cédulas, teléfonos ni documentos.

> [!NOTE]
> Mientras un partido está en juego o finalizado sin cerrar, el marcador y las posiciones públicas muestran el resultado **en vivo (no oficial)**. Pasa a ser oficial cuando la autoridad **cierra** el partido.

## Desde el panel

En la ficha de un partido (no borrador) el botón **Vista pública** abre la página pública de ese partido en otra pestaña. En el encabezado del panel, **Sitio público** lleva al inicio.
