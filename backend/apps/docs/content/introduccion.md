---
title: Bienvenida a FutOwl
summary: Qué es FutOwl, cómo está organizado y cómo usar este manual
section: manual
order: 10
---
FutOwl es la plataforma para **organizar torneos de fútbol de principio a fin**: registro de equipos y jugadores, armado de jornadas, confirmación de oficiales, mesa técnica en vivo, informes, cierre oficial de resultados y tabla de posiciones, todo con trazabilidad completa.

```futowl-mis-permisos
```

## Las dos caras de FutOwl

| Parte | Quién la usa | Qué ofrece |
|-------|--------------|------------|
| **Sitio público** (`/`) | Cualquier persona, sin iniciar sesión | Partidos del día, resultados en vivo, posiciones, goleadores y disciplina de los torneos publicados. |
| **Panel de gestión** (`/app`) | Usuarios con cuenta | Todo lo operativo: registro, torneos, jornadas, mesa técnica, informes, administración. |

Lo que ve cada usuario dentro del panel depende de sus **roles y permisos**. Si una opción del menú no aparece, normalmente es porque su cuenta no tiene el permiso correspondiente (vea [Cómo funcionan los permisos](/app/ayuda/como-funcionan-los-permisos)).

## Conceptos clave (glosario)

| Término | Significado |
|---------|-------------|
| **Categoría** | Rango de edad (Sub 12, Sub 15…). Se define con un *tope de edad*; FutOwl calcula el año de nacimiento mínimo cada año. |
| **Cancha** | Sede donde se juega. Si es *divisible* admite varios partidos a la vez (uno por mini cancha). |
| **Equipo** | Club con RIF, ubicación, categorías, cuerpo técnico y usuarios gestores. |
| **Jugador** | Ficha única de una persona. Se crea una sola vez y se inscribe en cada torneo con el equipo de turno. |
| **Nómina** | Lista de jugadores de un equipo **en un torneo** y categoría concretos. |
| **Torneo** | Competencia con sus reglas (duración, tiempos, cambios, puntuación), categorías y documentos. |
| **Inscripción** | Un equipo participando en un torneo para una categoría (opcionalmente dentro de un grupo). |
| **Fixture** | Conjunto de partidos (quién juega contra quién y en qué fecha/ronda). |
| **Jornada** | Día de competencia: agrupa partidos con cancha, horario, delegado y terna arbitral. |
| **Delegado** | Oficial que opera la **mesa técnica** del partido y envía el informe del delegado. |
| **Terna arbitral** | Árbitro principal y hasta dos asistentes (el torneo define cuántos se exigen). |
| **Confirmación** | Respuesta de cada oficial o equipo a su asignación: confirmar o rechazar (con motivo). |
| **Ajuste** | Cambio a un partido ya enviado, siempre con *exposición de motivos*; conserva el antes y el después. |
| **Mesa técnica** | Pantalla donde el delegado registra en tiempo real llegada, documentos, goles, tarjetas, cambios y fin. |
| **Informe** | Resumen oficial que envían delegado y árbitro al final; ambos deben coincidir para cerrar. |
| **Cierre** | Acto de la autoridad que vuelve oficial e inalterable el resultado de un partido o jornada. |
| **Nota / Apelación** | Único canal de reclamos o aclaraciones tras el cierre. Las apelaciones pasan a revisión. |

## Principios que debe conocer

> [!IMPORTANT]
> **En FutOwl nada se borra.** Los registros maestros (equipos, jugadores, canchas…) se *desactivan* y pueden reactivarse. Las operaciones confirmadas (eventos de mesa técnica, confirmaciones, informes, cierres) son de **solo inserción**: los errores se corrigen con un nuevo registro (anulación, ajuste, devolución) que deja la evidencia del original.

- **Todo queda auditado**: quién hizo qué, cuándo, desde qué IP y con qué cambios (vea [Auditoría](/app/ayuda/auditoria)).
- **Hora oficial de Venezuela (UTC-4)**: el reloj del encabezado se sincroniza con el servidor; todas las fechas se muestran en esa hora.
- **Tiempo real**: marcadores, cronologías, posiciones y notificaciones se actualizan solos cada pocos segundos mientras la pestaña está visible.

## Cómo usar este manual

- **Manual de usuario**: un capítulo por cada parte de la aplicación, en el orden en que se usa en un torneo. Si es nuevo, lea primero [Primeros pasos](/app/ayuda/primeros-pasos) y [El flujo completo de un torneo](/app/ayuda/flujo-del-torneo).
- **Preguntas frecuentes**: soluciones a casos concretos («no puedo enviar la jornada», «registré un gol al jugador equivocado»…).
- **Roles y permisos**: qué hace cada rol y cada permiso, con el catálogo completo y su acceso actual.
- **Referencia técnica**: cómo se conectan los módulos, estados de cada registro y la API.

Use el **buscador** del índice lateral para encontrar cualquier palabra en toda la documentación.
