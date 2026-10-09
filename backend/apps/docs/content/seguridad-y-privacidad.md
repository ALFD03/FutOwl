---
title: Seguridad y privacidad
summary: Cómo protege FutOwl la cuenta, los datos personales y los archivos, y buenas prácticas
section: manual
order: 270
---
## Su sesión

- La sesión usa un **token de corta duración (15 min) guardado solo en memoria** y una **cookie segura** (httpOnly) que lo renueva automáticamente durante **12 horas**.
- Al **cerrar sesión**, la cookie se invalida en el servidor.
- Tras **5 intentos fallidos** la cuenta se bloquea **15 minutos**.

## Datos personales

- **Cédulas, RIF y teléfonos** se guardan **cifrados** en la base de datos. Para buscarlos y evitar duplicados se usa un índice cifrado, nunca el dato en claro.
- El **sitio público** no muestra datos personales: solo nombres de equipos y jugadores en la cronología, goleadores y disciplina.
- La auditoría oculta los datos sensibles.

## Archivos

Fotos y documentos se validan antes de guardarse:

| Tipo | Formatos | Tamaño máximo |
|------|----------|---------------|
| Imágenes (fotos, logos) | JPG, JPEG, PNG, WEBP | 5 MB |
| Documentos | PDF, DOC, DOCX o imagen | 10 MB |

Además se comprueba la **firma real** del archivo (no basta con cambiar la extensión), se rechazan ejecutables y scripts disfrazados y el nombre del archivo se reemplaza por uno aleatorio.

## Registros inalterables

Eventos de mesa técnica, confirmaciones, ajustes, informes, devoluciones, cierres, notas, términos, aceptaciones, revisiones de esta documentación y la bitácora son de **solo inserción**: ni la aplicación ni el SQL directo pueden modificarlos o borrarlos.

## Buenas prácticas

- No comparta su usuario: todo lo que se haga con él queda a su nombre en la auditoría.
- Use una contraseña única de al menos 10 caracteres.
- Cierre sesión en equipos compartidos.
- Verifique que la dirección del sitio sea la oficial antes de escribir su contraseña.
