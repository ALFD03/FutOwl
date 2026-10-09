---
title: Canchas
summary: Sedes, medidas, canchas divisibles y capacidad de partidos simultáneos
section: manual
order: 70
---
**Ruta:** Registro → Canchas (`/app/canchas`) · **Permisos:** `registry.view_field`, `registry.add_field`, `registry.change_field`.

## Campos

| Sección | Campo | Notas |
|---------|-------|-------|
| General | **Nombre** | Ej.: *Cancha Municipal*. |
| Ubicación | País, estado, municipio, dirección | País por defecto: Venezuela. |
| Responsable | Nombre y **teléfono** del responsable | El teléfono se guarda **cifrado**. |
| Medidas y capacidad | **Largo/alto** y **ancho** (m) | Mínimo 1 m. |
| | **Cancha divisible** | Si se puede dividir en mini canchas. |
| | **Cantidad de mini canchas** | Solo si es divisible: de 2 a 16. |

## Capacidad simultánea

La **capacidad** es la cantidad de partidos que puede haber **a la vez** en la cancha:

- No divisible → capacidad **1**.
- Divisible con *N* mini canchas → capacidad **N**.

El listado la muestra en la columna *Simultáneos*.

## Cómo se usa al programar

Al guardar la cancha y el horario de un partido en una jornada (o en un ajuste), FutOwl:

1. Cuenta los partidos que se **solapan** en horario en esa cancha (sin contar los suspendidos).
2. Si ya hay tantos como la capacidad, **rechaza** el horario: *«La cancha … ya tiene N partido(s) en ese horario (capacidad simultánea: N)»*.
3. Si hay espacio, **asigna automáticamente la primera mini cancha libre** (o valida la indicada).

> [!TIP]
> Ejemplo: *Cancha Municipal* (2 mini canchas). Partidos de 08:00 a 09:10 en mini 1 y mini 2 → válidos. Un tercero de 08:30 a 09:40 → rechazado. Uno de 09:10 a 10:20 → válido (empieza cuando terminan los anteriores).

## Con qué se conecta

- **Torneos**: lista de *canchas disponibles (tentativas)* del torneo.
- **Equipos**: un equipo puede tener cancha sede.
- **Partidos y jornadas**: cancha y mini cancha asignadas.

Una cancha con partidos asociados no puede eliminarse; se **desactiva** para que no se ofrezca en nuevas programaciones.
