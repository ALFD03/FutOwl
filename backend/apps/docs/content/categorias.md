---
title: Categorías
summary: Rangos de edad por año de nacimiento y cómo se calcula la elegibilidad
section: manual
order: 60
---
**Ruta:** Registro → Categorías (`/app/categorias`) · **Permisos:** `registry.view_category` para ver, `registry.add_category` para crear, `registry.change_category` para editar o desactivar.

## Qué es

Una categoría agrupa a los jugadores por edad. Se define con:

| Campo | Descripción | Ejemplo |
|-------|-------------|---------|
| **Nombre** | Único en el sistema. | `Sub 12` |
| **Tope de edad** | Edad máxima de la categoría (1 a 99). | `11` |

FutOwl calcula el **año de nacimiento tope** contra el año en curso: `año actual − tope de edad`.

| Año en curso | Tope 11 → admite nacidos desde |
|--------------|-------------------------------|
| 2026 | 2015 |
| 2027 | 2016 |
| 2030 | 2019 |

El listado muestra la columna *Nacidos desde (año actual)* y el formulario lo explica en vivo mientras escribe el tope.

## Con qué se conecta

- **Equipos**: cada equipo declara en qué categorías compite (pestaña *Categorías* de su ficha).
- **Torneos**: definen sus *categorías permitidas*.
- **Inscripciones**: un equipo solo puede inscribirse en una categoría que tenga **y** que el torneo permita.
- **Nómina**: un jugador es **elegible** si su **año** de nacimiento es igual o posterior al año tope. Se valida por año, no por fecha exacta.

## Ejemplos

- *Sub 12 (tope 11)* en 2026: un jugador nacido el 31/12/2014 **no** es elegible; uno nacido el 01/01/2015 **sí**.
- Un torneo que permite *Sub 12* y *Sub 15* acepta la inscripción de Águilas FC en Sub 15 solo si Águilas tiene registrada la categoría Sub 15.

## Operaciones

- **Crear**: botón **Nueva categoría**.
- **Editar**: ícono de lápiz. Cambiar el tope afecta la elegibilidad de **nuevas** inscripciones en la nómina; las ya hechas no se borran.
- **Desactivar**: ícono de apagado. La categoría deja de ofrecerse en los formularios, pero se conserva su historial.
