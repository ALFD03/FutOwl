---
title: Cómo editar la documentación
summary: Guía para el superusuario - editor Markdown, avisos, widgets, publicación e historial
section: reference
order: 40
---
> [!IMPORTANT]
> Solo el **superusuario** puede crear, editar, publicar o despublicar páginas de ayuda. El resto de usuarios solo las lee.

## Editar una página

1. Abra la página y pulse **Editar** (arriba a la derecha).
2. Modifique título, sección, orden, resumen o contenido.
3. Use la vista **Escribir**, **Dividido** (Markdown y vista previa lado a lado) o **Vista previa**.
4. Pulse **Guardar cambios**.

Cada guardado crea una **revisión inalterable**. Con **Historial** puede ver versiones anteriores y **cargar una en el editor** para restaurarla (luego guarde).

## Crear una página

En el inicio de la ayuda pulse **Nueva página**. Complete:

| Campo | Notas |
|-------|-------|
| Título | Se muestra en el índice. |
| Identificador (URL) | Se propone a partir del título (minúsculas, números y guiones). **No se puede cambiar después** para no romper enlaces. |
| Sección | Manual de usuario, Preguntas frecuentes, Roles y permisos o Referencia técnica. |
| Orden | Posición dentro de la sección (menor = primero). Use saltos de 10 para poder intercalar. |
| Resumen | Una línea bajo el título. |
| Publicada | Si está apagado, solo el superusuario la ve (útil para borradores). |

Las páginas no se eliminan: **despublíquelas**.

## Sintaxis Markdown admitida

| Escriba | Resultado |
|---------|-----------|
| `## Título` / `### Subtítulo` | Títulos (aparecen en el índice *En esta página*). |
| `**negrita**`, `_cursiva_`, `~~tachado~~` | Formato de texto. |
| `- elemento` / `1. elemento` | Listas. |
| `- [ ] tarea` / `- [x] hecha` | Lista de tareas. |
| `[texto](/app/ayuda/mesa-tecnica)` | Enlace interno (a la ayuda o a cualquier pantalla `/app/...`). |
| `[texto](https://...)` | Enlace externo (se abre en otra pestaña). |
| `` `codigo` `` | Código en línea. |
| Tres comillas invertidas | Bloque de código. |
| `\| a \| b \|` | Tablas. |
| `---` | Línea separadora. |
| `![descripción](https://…/imagen.png)` | Imagen (debe estar alojada en un dominio permitido, como el almacenamiento de FutOwl). |

Por seguridad **no se interpreta HTML** dentro del Markdown.

## Avisos

```
> [!NOTE]
> Información complementaria.

> [!TIP]
> Un consejo práctico.

> [!IMPORTANT]
> Algo que no debe pasarse por alto.

> [!WARNING]
> Una advertencia.

> [!CAUTION]
> Riesgo de un error difícil de revertir.
```

Se ven así:

> [!TIP]
> Este es un aviso de tipo *consejo*.

## Widgets dinámicos

Escriba un bloque de código con uno de estos lenguajes (vacío por dentro) para insertar contenido que se calcula en vivo. También puede usar **Insertar widget…** en la barra del editor.

| Bloque | Muestra |
|--------|---------|
| `futowl-mis-permisos` | Roles y permisos de **quien está leyendo**. |
| `futowl-roles` | Roles vigentes con sus permisos y cantidad de usuarios. |
| `futowl-permisos` | Catálogo completo de permisos con buscador, filtro por rol y columna *Usted*. |

Ejemplo:

````
```futowl-roles
```
````

## Enlazar a una sección concreta

Cada título genera un ancla a partir de su texto, sin acentos ni signos: `## Cerrar la jornada` → `#cerrar-la-jornada`. Ejemplo: `[Cerrar la jornada](/app/ayuda/jornadas#6-cerrar-la-jornada)`.

## Contenido base

El contenido inicial viene en archivos Markdown del repositorio (`backend/apps/docs/content/`) y se carga al migrar. Un técnico puede ejecutar `python manage.py load_docs` para crear las páginas que falten, o `load_docs --overwrite` para **reemplazar** el contenido con el de los archivos (queda una revisión en el historial, así que lo editado desde la web puede recuperarse).
