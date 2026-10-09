---
title: Jugadores y representantes
summary: Ficha única del jugador, edad, representante obligatorio para menores, equipo actual e historial
section: manual
order: 90
---
**Rutas:** Registro → Jugadores (`/app/jugadores`) y Registro → Representantes (`/app/representantes`) · **Permisos:** `registry.view_player` / `add_player` / `change_player` y `registry.view_guardian` / `add_guardian` / `change_guardian`.

## La ficha única del jugador

Un jugador se registra **una sola vez** en FutOwl. En cada torneo se **inscribe en la nómina** del equipo con el que juega ese torneo; así se conserva su historial completo aunque cambie de club.

| Campo | Notas |
|-------|-------|
| **Nombres y apellidos** | Obligatorios. |
| **Fecha de nacimiento** | Obligatoria, no puede ser futura. La **edad** se calcula sola. |
| **Soporte de identidad** | *Cédula de identidad* o *Partida de nacimiento*. |
| Cédula | Obligatoria si el soporte es cédula; opcional con partida de nacimiento. Se guarda cifrada y no puede repetirse. |
| Teléfono | Propio o del representante (cifrado). |
| Foto / foto del documento | Imagen (máx. 5 MB) / documento (máx. 10 MB). |
| **Representante** | **Obligatorio si el jugador es menor de 18 años.** |

## Representantes

Responsables legales de jugadores menores de edad: nombres, apellidos, **cédula**, **teléfono** (obligatorio), parentesco y foto de la cédula. Un representante puede tener varios jugadores a su cargo (hermanos, por ejemplo).

> [!TIP]
> Registre primero al representante (**Registro → Representantes → Nuevo representante**) y luego, al crear al jugador, selecciónelo en el campo *Representante*.

## Listado de jugadores

Columnas: nombre y documento, **edad**, **equipo actual** (o *Libre*), **Ha jugado en** (equipos anteriores), estadísticas **G · PJ · TA · TR** (goles, partidos jugados, amarillas, rojas) y representante (en rojo *Falta* si es menor sin representante).

Pulse un jugador para abrir su **ficha**: estadísticas acumuladas en todos los torneos, torneos y equipos en los que ha estado.

## Equipo actual

El *equipo actual* es el que administra hoy la ficha del jugador:

- Al crear un jugador desde un equipo, queda con ese equipo como actual.
- **Cambia automáticamente** cuando el jugador se inscribe en la nómina de un torneo con otro equipo.
- Solo el **equipo actual** (sus gestores o entrenadores con usuario) o un administrador del registro puede **editar** la ficha.

## Reglas de elegibilidad en la nómina

Al inscribir a un jugador en un torneo, FutOwl comprueba que:

1. El jugador esté **activo**.
2. Su **año de nacimiento** sea igual o posterior al año tope de la categoría (vea [Categorías](/app/ayuda/categorias)).
3. **No esté ya activo con otro equipo en el mismo torneo** (en torneos distintos sí puede jugar con equipos distintos).
4. El **dorsal** no esté repetido en esa nómina.
5. El torneo **no esté finalizado** y la inscripción del equipo esté activa.

## Ejemplos

- *Luis Mora*, nacido el 05/05/2016 (10 años): necesita representante. Puede inscribirse en Sub 12 (2026: desde 2015).
- *Luis* juega la *Copa Apertura* con Águilas FC. En la *Copa Clausura* lo inscriben con Leones del Este: su equipo actual pasa a ser Leones y en Águilas aparece en *Han jugado con el equipo*.
- Intentar inscribirlo también con Toros en la *Copa Apertura* da el error *«El jugador ya está inscrito con «Águilas FC» en este torneo»*.

Vea también [Preguntas frecuentes de registro](/app/ayuda/faq-registro).
