---
title: Arquitectura y conexiones entre módulos
summary: Cómo se relacionan los datos de FutOwl y qué tecnologías los sostienen
section: reference
order: 10
---
## Cómo está construido

| Capa | Tecnología | Función |
|------|------------|---------|
| Interfaz | React + TypeScript (Vite, Tailwind) | Sitio público y panel; se comunica con la API por HTTPS. |
| API | Django + Django REST Framework | Reglas de negocio, permisos, validaciones y auditoría. |
| Base de datos | PostgreSQL en Supabase | Datos; cifrado de campos sensibles; RLS y triggers de solo inserción. |
| Archivos | Supabase Storage | Fotos, logos, documentos, planillas e informes adjuntos. |
| Despliegue | Vercel | Interfaz estática y API como función en el mismo dominio (`/api`). |

La interfaz no guarda datos propios: **todo pasa por la API**, que es donde se comprueban los permisos. Los datos en tiempo real se obtienen por consultas periódicas (3 a 30 s).

## Mapa de relaciones

```
Categoría ──┬── Equipo ──┬── Entrenadores (uno por equipo a la vez)
            │            ├── Gestores (usuarios)
            │            └── Jugadores (equipo actual) ── Representante (menores)
            │
            └── Torneo ──┬── Canchas disponibles
                         ├── Grupos (por categoría)
                         └── Inscripción (equipo + categoría [+ grupo])
                                 └── Nómina: Jugador + dorsal (uno por torneo)

Torneo ── Jornada ── Partido (local/visitante = inscripciones)
                       ├── Cancha + mini cancha + horario
                       ├── Delegado / Árbitro / Asistentes ── Usuario vinculado
                       ├── Confirmaciones (por parte y versión de asignación)
                       ├── Ajustes (antes/después + motivo)
                       ├── Alineaciones ── Jugadores de la nómina
                       ├── Eventos de mesa técnica (cronología)
                       ├── Informes (delegado / árbitro, con versiones) ── Devoluciones
                       ├── Cierre (resultado oficial)
                       ├── Notas / Apelaciones
                       └── Casos en revisión (rechazos y apelaciones)

Transversal: Usuarios ── Roles ── Permisos · Auditoría · Notificaciones · Términos · Documentación
```

## Qué alimenta a qué

| Origen | Destino | Cómo |
|--------|---------|------|
| Categoría (tope de edad) | Nómina | Filtra jugadores elegibles por año de nacimiento. |
| Equipo (categorías) | Inscripción | Solo categorías que el equipo tenga y el torneo permita. |
| Inscripción | Fixture | El generador crea partidos entre las inscripciones de la categoría/grupo. |
| Reglas del torneo | Jornada, alineación, mesa técnica, posiciones | Hora de fin, límites de planilla y cambios, tiempos, puntuación. |
| Cancha (capacidad) | Programación | Partidos simultáneos y mini cancha asignada. |
| Usuario vinculado | Confirmaciones, mesa técnica, informes, Mis asignaciones | Identifica quién es quién en cada partido. |
| Nómina | Alineación | Solo jugadores activos de la nómina. |
| Alineación | Mesa técnica | Titulares en el campo, suplentes en el banco; verificación de documentos. |
| Cronología | Marcador en vivo, comparación de informes, estadísticas | Se recalcula descartando eventos anulados. |
| Informes coincidentes | Cierre | El cierre toma el resultado del informe. |
| Cierres | Posiciones oficiales | La tabla oficial solo usa partidos cerrados. |
| Cualquier cambio | Auditoría | Bitácora encadenada con hash. |
| Envíos, confirmaciones, ajustes, cierres… | Notificaciones | Avisos a los involucrados o a quienes tienen un permiso. |

## Hora oficial

El servidor trabaja en `America/Caracas` (UTC-4) y guarda las fechas en UTC. La interfaz sincroniza su reloj con `/api/time/` compensando la latencia, de modo que horarios y minutos de juego son consistentes aunque el dispositivo tenga otra hora.
