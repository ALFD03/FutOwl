---
title: Documentos del torneo
summary: Exportar planilla de alineación, tarjetas de cambio y reglamento en PDF o Word, e importar plantillas
section: manual
order: 220
---
**Dónde:** torneo → **Documentación**. Cualquier usuario que pueda ver el torneo puede **exportar**; para guardar el reglamento o importar plantillas se necesita `tournaments.change_tournament`.

## Exportar

1. Elija el **equipo / categoría** (no hace falta para el reglamento).
2. Pulse **PDF** o **DOCX** en el documento deseado.

| Documento | Contenido |
|-----------|-----------|
| **Planilla de alineación** | Generada con la **nómina** del equipo: columnas ID, cédula, nombre, fecha de nacimiento, dorsal, convocado, titular y capitán, más el cuerpo técnico. Si se exporta desde un partido, incluye los datos del partido y la alineación cargada. |
| **Tarjetas de cambio** | Tarjetas imprimibles para la mesa técnica (6 por defecto). |
| **Reglamento** | Generado desde el texto del reglamento escrito en FutOwl. |

Cada exportación de planilla queda registrada en la auditoría.

> [!TIP]
> La planilla exportada en **Word** es la que luego se puede **importar** en la alineación del partido (vea [Alineaciones](/app/ayuda/alineaciones)).

## Reglamento en texto

En la tarjeta **Reglamento (texto)** escriba el reglamento con títulos (`#`, `##`) y listas (`-`) y pulse **Guardar**. Ejemplo:

```
# Capítulo I · Disposiciones generales
- Artículo 1. Los partidos tendrán dos tiempos de 30 minutos.
- Artículo 2. Cada equipo podrá realizar hasta 5 cambios.
```

## Importar plantillas propias

Si el torneo usa formatos propios (Word o PDF), súbalos con **Editar** en el encabezado del torneo, sección *Documentación (importar)*: reglamento, plantilla de planilla y plantilla de tarjeta de cambio. Aparecen como enlace *Plantilla importada* en cada documento.

Archivos admitidos: PDF, DOC, DOCX o imagen, hasta 10 MB. FutOwl comprueba la **firma real** del archivo (no solo la extensión) y rechaza ejecutables o contenido peligroso.
