---
title: Términos y condiciones
summary: Aceptación obligatoria, publicación de nuevas versiones y su efecto en los usuarios
section: manual
order: 260
---
## Para todos los usuarios

- Los términos vigentes se leen en el sitio público (**Términos**, `/terminos`).
- Para usar el panel es **obligatorio aceptar** la versión vigente. Hasta aceptarla, FutOwl redirige a la pantalla de aceptación y la API rechaza las operaciones.
- Cada aceptación queda registrada con versión, fecha, IP y navegador.

## Publicar una nueva versión

**Ruta:** Administración → Términos (`/app/terminos`) · **Permiso:** `legal.add_termsversion`.

1. Escriba el **número de versión** (por ejemplo `1.1`), el **título** y el **contenido** (mínimo 50 caracteres). Admite títulos con `#` y listas con `-`; a la derecha verá la vista previa.
2. Pulse **Publicar**.

> [!WARNING]
> Las versiones **no se editan**: cada cambio es una versión nueva. Al publicarla, **todos los usuarios** deberán aceptarla en su próximo acceso antes de seguir trabajando.
