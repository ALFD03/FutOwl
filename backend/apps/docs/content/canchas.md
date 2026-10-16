---
title: Canchas
summary: Sedes, medidas, canchas divisibles y cuántos partidos entran a la vez según la categoría
section: manual
order: 70
---
**Ruta:** Registro → Canchas (`/app/canchas`) · **Capacidades:** *Consultar el registro* para ver; *Gestionar canchas* para crear, editar y desactivar.

## Campos

| Sección | Campo | Notas |
|---------|-------|-------|
| General | **Nombre** | Ej.: *Cancha Municipal*. |
| Ubicación | País, estado, municipio, dirección | País por defecto: Venezuela. |
| Responsable | Nombre y **teléfono** del responsable | El teléfono se guarda **cifrado**. |
| Medidas y capacidad | **Largo/alto** y **ancho** (m) | Mínimo 1 m. |
| | **Cancha divisible** | Si se puede dividir para jugar **varios partidos a la vez** (arcos móviles, demarcación). |

## Partidos a la vez: dependen de la categoría

No es lo mismo una Sub 6 que una Sub 12: cada **categoría** tiene sus **medidas de juego** (largo y ancho de la superficie en que se juega, en *Registro → Categorías → Reglas de juego*), y la cantidad de partidos que entran a la vez en una cancha **divisible** es cuántas de esas superficies caben en ella (en cualquiera de las dos orientaciones):

| Cancha 100 × 64 m, divisible | Medidas de juego | Partidos a la vez |
|------------------------------|------------------|-------------------|
| Sub 6 | 30 × 25 m | **8** |
| Sub 8 | 40 × 25 m | **4** |
| Sub 12 (media cancha) | 64 × 50 m | **2** |
| Sub 16 | vacío (cancha completa) | **1** |

- Si la cancha **no es divisible**, se juega **un partido a la vez**, sea cual sea la categoría.
- Si la categoría no tiene medidas de juego, o su superficie es más grande que la cancha, ocupa la **cancha completa**.
- Un torneo puede ajustar las medidas de juego de una categoría solo para sí (pestaña *Reglas de juego* del torneo).

## Cómo se usa al programar

Cada partido ocupa una **fracción** de la cancha: 1/8 uno de Sub 6, 1/2 uno de Sub 12, la cancha completa uno de Sub 16. Al guardar la cancha y el horario de un partido en una jornada (o en un ajuste), FutOwl:

1. Suma lo que ocupan los partidos que se **solapan** en horario en esa cancha (sin contar los suspendidos), **de cualquier categoría**.
2. Si el nuevo partido ya no cabe (la suma pasaría de la cancha completa), **rechaza** el horario: *«La cancha … no tiene espacio en ese horario: ya tiene N partido(s) y uno de Sub 12 ocupa 1/2 de la cancha (2 a la vez)»*.
3. Si hay espacio, **asigna automáticamente la primera mini cancha libre** (numerada entre los partidos del mismo tamaño: *mini cancha 3 de 8*), o valida la indicada.

> [!TIP]
> Ejemplo en una cancha de 100 × 64 m divisible: a las 09:00 un partido de Sub 12 (media cancha) y 4 de Sub 6 (cada uno 1/8) → válidos, la cancha queda llena. Un quinto de Sub 6 a las 09:00 → rechazado. Uno de Sub 12 a las 09:40, cuando ya terminaron los anteriores → válido.

## Con qué se conecta

- **Torneos**: lista de *canchas disponibles (tentativas)* del torneo.
- **Equipos**: un equipo puede tener cancha sede.
- **Categorías**: sus medidas de juego definen cuántos partidos entran a la vez.
- **Partidos y jornadas**: cancha y mini cancha asignadas; la tarjeta de cada cancha en la jornada muestra cuántos partidos de cada categoría entran a la vez.

Una cancha con partidos asociados no puede eliminarse; se **desactiva** para que no se ofrezca en nuevas programaciones.
