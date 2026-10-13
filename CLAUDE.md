# FutOwl · guía para Claude

Gestión de torneos de fútbol (registro, torneos, jornadas, mesa técnica en vivo, informes, sitio público).
Todo el producto, la UI, los mensajes, los commits y la documentación van **en español**. Responda al usuario en español.

## Flujo de trabajo (obligatorio)
- Tras cada cambio pedido: verificar (pruebas/typecheck según lo tocado) → **commit + push a `develop` sin preguntar**.
  PR (`develop` → `master`) **solo** cuando el usuario lo pida. Nunca tocar `master` directamente.
- Git no tiene identidad global en esta máquina:
  `git -c user.name="Angel Flores" -c user.email="angelluisflores03@gmail.com" commit ...` + trailer `Co-Authored-By` de Claude.
- Si hay migraciones nuevas: Vercel no migra → `make migrate` (qa) tras el push; producción (`ENV=production`) solo si se pide.
- Cambios en `backend/apps/docs/content/*.md` en una base existente: `make docs` para recargarlos.

## Entornos (no hay base de datos local)
| Rama | Vercel | Supabase (proyecto `lgcaxrocqdgxmhjesqtx`) | Bucket S3 | Archivo local de secretos |
|------|--------|---------------------------------------------|-----------|---------------------------|
| `develop` y `make dev` | Preview (tras Vercel Auth → `vercel curl`) | esquema `qa`, rol `futowl_qa` | `futowl-qa` | `.env.vercel.preview` |
| `master` | Production (futowl.vercel.app) | esquema `public`, rol `futowl_prod` | `futowl` | `.env.vercel.production` |

- `make dev` carga `.env.vercel.preview` tal cual (settings **production**) y solo pone `SECURE_SSL_REDIRECT=false`.
  Lo que se haga en local se ve en los previews.
- Los `.env.vercel.*` son la **única copia** de los secretos: `vercel env pull` los devuelve enmascarados. Nunca imprimir
  sus valores (enmascarar al inspeccionar); nunca commitearlos.
- Vercel: usar la CLI (`npx vercel@63.1.0 …`); el MCP de Vercel da 403 en este equipo.
- Pruebas: `config.settings.test` (SQLite en memoria). Nunca correr pruebas ni `seed_demo` contra qa/producción sin pedirlo.

## Comandos (`make` lista todos)
- `make setup` (deps + verifica `.env.vercel.*`) · `make dev` (puertos ocupados → propone otros)
- `make migrate|roles|superuser|docs|shell|secure-db [ENV=production]` (producción pide confirmación)
- `make migrations` (sin Supabase) · `make test-backend [T=apps.x]` · `make test-frontend` · `make typecheck` · `make check` · `make ci`
- Datos de prueba en qa (solo base limpia, sin torneos): `manage.py seed_test_data` con el entorno de `.env.vercel.preview`
  (50 equipos × 8 categorías × 22 jugadores, oficiales y canchas; contraseña común `FutOwl#2026!`).
- Capacidades (`accounts/capabilities.py`): al cambiarlas, `manage.py build_capability_catalog` y `make docs`.

## Arquitectura
- **Backend** `backend/` — Django 5.2 + DRF + SimpleJWT. Apps: `core` (base), `accounts` (usuarios/roles), `registry`
  (categorías, canchas, equipos, jugadores, oficiales), `tournaments` (torneo, reglas por categoría, grupos, inscripciones,
  nómina, documentos), `competition` (jornadas, partidos, alineaciones, mesa técnica, informes; lógica en `services/`),
  `audit`, `legal` (términos), `notifications`, `docs` (centro de ayuda en Markdown).
  Rutas API en `config/api_urls.py`; Vercel entra por `api/index.py`.
- **Frontend** `frontend/src/` — React 19 + Vite + TS + Tailwind + TanStack Query. `services/` (`createResource`),
  `types/index.ts`, `components/{ui,forms,crud,layout,match,docs}`, `pages/app/<módulo>/`, `pages/public/`.

## Convenciones
- Vistas delgadas; la lógica de negocio va en `services/`. Serializers de escritura heredan `CleanModelSerializer`
  (ejecuta `model.clean()`); viewsets CRUD heredan `NoDeleteModelViewSet`.
- **Nada se borra**: `BaseEntity` se desactiva (`activate`/`deactivate`); tablas `ImmutableModel` son de solo inserción
  (triggers en Postgres). Correcciones = nuevos registros.
- Permisos de modelo (`ModelActionPermission`); roles en `accounts/roles.py` + `seed_roles`. Todo permiso nuevo debe
  documentarse en `docs/content/catalogo-de-permisos.md` (hay una prueba que lo exige).
- Modelo nuevo en Postgres: la migración incluye `RunPython(enable_row_level_security, noop)` (`apps.core.db`).
- Reglas de juego: son de la categoría; usar `match.rules` / `tournament.rules_for(category)` (ajuste del torneo o categoría).
- Partidos de eliminación directa (`stage != "regular"`): `home`/`away` pueden ser null hasta llenar la llave; usar
  `home_label`/`away_label`. La llave vive en `competition/services/bracket.py`.
- Flujo de jornada: la autoridad envía cancha y horario; los jefes asignan oficiales (`assign-officials`); el partido se
  confirma con los oficiales y recién ahí se avisa a los equipos (su confirmación es informativa).
- Frontend: formularios con `ResourceForm` + `FieldDef[]`; permisos en UI con `<Can perm="app.codename">` / `useCan`.
- Datos sensibles cifrados (`FIELD_ENCRYPTION_KEY`, índices ciegos con `BLIND_INDEX_KEY`): no cambiar esas claves.
- Archivos en Supabase Storage vía `django-storages` (bucket privado, URLs firmadas SigV4).

## Ahorro de contexto
- No leer `frontend/package-lock.json`, `node_modules/`, `backend/.venv/`, `frontend/dist/` ni migraciones antiguas
  salvo que haga falta. Buscar con `grep` dirigido antes de abrir archivos grandes.
- Los manuales de usuario están en `backend/apps/docs/content/`; el README cubre despliegue y variables.
