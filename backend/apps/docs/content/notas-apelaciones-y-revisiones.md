---
title: Notas, apelaciones y revisiones
summary: Canal permanente de reclamos y aclaraciones, y la bandeja de casos de las autoridades
section: manual
order: 200
---
## Notas y apelaciones

**Dónde:** ficha del partido → **Notas y apelaciones**. **Permiso para escribir:** `competition.add_matchnote` (lo tienen casi todos los roles operativos).

| Tipo | Uso | Efecto |
|------|-----|--------|
| **Nota** | Aclaraciones o información adicional. | Queda registrada de forma permanente. |
| **Apelación** | Reclamo sobre un caso extraordinario (resultado, sanción, incidente). | Además crea un **caso en revisión** y notifica a las autoridades. |

Escriba el texto (mínimo 3 caracteres), adjunte un archivo si lo necesita (PDF, imagen o Word) y pulse **Registrar**. Las notas **no se editan ni se borran** y son el único canal para aportar información **después del cierre** de un partido o jornada.

## Revisiones

**Ruta:** Competición → Revisiones (`/app/revisiones`). **Permisos:** `competition.view_reviewcase` para ver; `competition.resolve_reviewcase` para resolver.

Bandeja de casos que necesitan decisión de una autoridad:

| Tipo | Origen |
|------|--------|
| **Rechazo de asignación** | Un delegado, árbitro o equipo rechazó su asignación. |
| **Apelación** | Alguien registró una apelación en un partido. |

Filtre por *Abiertos*, *Resueltos*, *Desestimados* o *Todos*. Pulse un caso para ver el motivo, quién lo presentó y cuándo.

### Resolver un caso

1. Escriba la **resolución** (mínimo 5 caracteres).
2. Pulse:
   - **Resolver**: el caso se atendió (por ejemplo, se reasignó al oficial con un ajuste).
   - **Desestimar**: no procede. En un rechazo de asignación, la parte **puede volver a responder** su asignación.
3. Quien presentó el caso recibe una notificación con la resolución.

> [!IMPORTANT]
> Para **reasignar** a quien rechazó, use **Ajustar** en el partido (queda la exposición de motivos) y luego resuelva el caso. Un caso resuelto o desestimado **no puede modificarse**.
