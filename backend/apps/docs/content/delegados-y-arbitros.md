---
title: Delegados y árbitros
summary: Oficiales de partido, licencia, usuario vinculado y lo que puede hacer cada uno
section: manual
order: 110
---
**Rutas:** Registro → Delegados (`/app/delegados`) y Registro → Árbitros (`/app/arbitros`) · **Capacidades:** *Consultar el registro* para ver; *Gestionar delegados* y *Gestionar árbitros* para registrar y editar.

## Campos

| Campo | Notas |
|-------|-------|
| Nombres, apellidos, **cédula**, teléfono, foto, foto de la cédula | Cédula y teléfono cifrados; la cédula no puede repetirse. |
| **Licencia** | *Avalado* o *No avalado*. |
| **Usuario de acceso** | *Sin usuario*, *Vincular existente* o *Crear usuario*. Recibe el rol **Delegado** o **Árbitro**. |

> [!IMPORTANT]
> **Sin usuario vinculado, el oficial no puede confirmar su asignación, operar la mesa técnica ni enviar informes.** FutOwl identifica al delegado o árbitro de un partido por el usuario vinculado a su ficha.

## El delegado

Responsable de la **mesa técnica** del partido:

1. Confirma o rechaza su asignación.
2. El día del partido registra llegada, documentación, inicio, goles, tarjetas, cambios, incidencias y fin.
3. Verifica que la alineación cargada coincida con los documentos presentados.
4. Envía el **informe del delegado** al finalizar.

Solo el **delegado asignado** al partido puede operar su mesa técnica (salvo usuarios con el permiso *Mesa técnica de cualquier partido*).

## La terna arbitral

- **Árbitro principal**, **asistente 1** y **asistente 2**. El torneo define cuántos se exigen (1, 2 o 3).
- Todos los exigidos deben **confirmar** para que el partido quede válido.
- Un mismo árbitro no puede ocupar dos posiciones en la terna.
- Solo el **árbitro principal** envía el **informe arbitral**.

## Reglas de disponibilidad

Al programar, FutOwl impide que un **delegado** o un **árbitro** (en cualquier posición) tenga **dos partidos que se solapen** en horario. El error indica el campo exacto: *«El árbitro ya tiene otro partido asignado en ese horario»*.

## Jefes de delegados y de árbitros

Los roles *Jefe de delegados* y *Jefe de árbitros* pueden registrar y editar oficiales de su área y **devolver informes** para corrección. Para **programar partidos** en las jornadas (cancha, horario y oficiales) necesitan además el permiso *Programar jornadas y partidos*. Vea [Roles predefinidos](/app/ayuda/roles-predefinidos).
