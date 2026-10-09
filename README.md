<p align="center">
  <img src="frontend/public/brand/logo.png" alt="FutOwl" width="220" />
</p>

<h1 align="center">FutOwl · Gestión de torneos de fútbol</h1>

<p align="center">
  Partidos, resultados y estadísticas en tiempo real · Jornadas confirmadas · Mesa técnica digital · Trazabilidad total
</p>

---

## Índice

1. [Stack](#stack)
2. [Estructura del proyecto](#estructura-del-proyecto)
3. [Puesta en marcha local](#puesta-en-marcha-local)
4. [Flujo del torneo](#flujo-del-torneo)
5. [Modelos](#modelos)
6. [Seguridad](#seguridad)
7. [Inalterabilidad y auditoría](#inalterabilidad-y-auditoría)
8. [Roles y permisos](#roles-y-permisos)
9. [Hora oficial (UTC-4) y tiempo real](#hora-oficial-utc-4-y-tiempo-real)
10. [Documentos (exportar / importar)](#documentos-exportar--importar)
11. [API](#api)
12. [Despliegue: Vercel + Supabase](#despliegue-vercel--supabase)
13. [Pruebas](#pruebas)

---

## Stack

| Capa | Tecnología |
|------|------------|
| Backend | Python 3.12+, Django 5.2, Django REST Framework, SimpleJWT, django-filter |
| Frontend | TypeScript, React 19, Vite, Tailwind CSS 3, TanStack Query, React Router 7 |
| Base de datos | PostgreSQL en **Supabase** (SQLite en local) |
| Archivos | **Supabase Storage** (API S3) mediante `django-storages` |
| Despliegue | **Vercel**, un solo proyecto: frontend estático + Django como función Python en `/api` |
| Documentos | ReportLab (PDF) y python-docx (Word) |

## Estructura del proyecto

```
FutOwl/
├── backend/                     # API Django
│   ├── config/                  # settings (base/development/production/test), urls, wsgi
│   ├── apps/
│   │   ├── core/                # cifrado, validadores, permisos/decoradores, modelos base, fábricas
│   │   ├── audit/               # bitácora inalterable con cadena de hashes
│   │   ├── accounts/            # usuarios, login seguro (JWT + cookie httpOnly), roles
│   │   ├── legal/               # términos y condiciones versionados + aceptaciones
│   │   ├── notifications/       # notificaciones a usuarios
│   │   ├── registry/            # categorías, canchas, entrenadores, representantes, jugadores,
│   │   │                        # delegados, árbitros, equipos y nómina
│   │   ├── tournaments/         # torneos, grupos, inscripciones y documentos (PDF/Word)
│   │   └── competition/         # jornadas, partidos, confirmaciones, ajustes, alineaciones,
│   │       └── services/        # mesa técnica, informes, cierre, revisiones, fixture, posiciones
│   └── requirements.txt
├── api/index.py                 # entrada de Vercel: monta Django como función Python
├── vercel.json                  # build de Vite + función Django + rewrites y cabeceras
├── requirements.txt             # → backend/requirements.txt (para la función de Vercel)
├── frontend/                    # SPA React
│   ├── public/brand/            # logos e isotipos
│   └── src/
│       ├── api/                 # cliente HTTP (token en memoria + renovación automática)
│       ├── services/            # servicios por dominio (fábrica CRUD genérica)
│       ├── context/             # Auth, Tema, Reloj sincronizado, Notificaciones (toasts)
│       ├── hooks/               # useAuth, useCan, useLiveInterval, useMutationAction…
│       ├── components/
│       │   ├── ui/              # Card, Modal, DataTable, Badge, Tabs, ConfirmDialog…
│       │   ├── forms/           # formularios generados desde definiciones de campos
│       │   ├── crud/            # ResourcePage: listado + alta/edición + activar/desactivar
│       │   ├── layout/          # AppLayout, PublicLayout, guardas de permisos, reloj UTC-4
│       │   └── match/           # marcador, cronología, mesa técnica, alineaciones, informes
│       ├── pages/               # public/ y app/ (registry, tournaments, competition, admin)
│       ├── config/              # navegación con permisos
│       ├── types/               # tipos de dominio
│       └── utils/               # fechas (America/Caracas), errores, etiquetas, markdown seguro
└── .github/workflows/ci.yml     # pruebas, typecheck y build
```

Cada módulo tiene una responsabilidad única: las **vistas** solo validan entrada/salida y delegan en **servicios** (`apps/competition/services/*`), donde vive la lógica de negocio.

## Puesta en marcha local

Requisitos: Python 3.12+, Node 22+ y `make` (Linux/macOS; en Windows use WSL o Git Bash).

### Con Makefile (recomendado)

```bash
make setup   # instala dependencias, crea .env con claves nuevas, migra y carga datos demo
make dev     # backend :8000 + frontend :5173 a la vez (Ctrl+C detiene ambos)
make         # lista todos los comandos
```

| Comando | Qué hace |
|---------|----------|
| `make dev` / `make backend` / `make frontend` | Levanta ambos servicios o solo uno |
| `make migrate` · `make migrations` · `make roles` | Migraciones y roles con permisos |
| `make demo` · `make superuser` · `make reset-db` | Datos demo, superusuario, recrear la base local |
| `make test` · `make test-backend T=apps.core` · `make test-frontend` | Pruebas (todas, filtradas o solo frontend) |
| `make typecheck` · `make check` · `make ci` | Tipos, chequeos de Django y el mismo pipeline de CI |
| `make build` · `make preview` | Build de producción del frontend y vista previa |
| `make keys` | Genera claves seguras para producción |
| `make shell` · `make secure-db` · `make clean` | Shell de Django, protecciones de Supabase, limpieza |

### Manual

```bash
# Backend
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env            # ajuste las claves (ver comentarios)
python manage.py migrate
python manage.py seed_roles     # crea los roles con sus permisos
python manage.py seed_demo      # (opcional) datos de demostración con un partido en vivo
python manage.py runserver      # http://127.0.0.1:8000

# Frontend (otra terminal)
cd frontend
npm install
npm run dev                     # http://localhost:5173 (proxy /api → Django)
```

Con `seed_demo` se crean los usuarios `admin`, `autoridad`, `consulta`, `delegado1-2`, `arbitro1-6` y `gestor1-6` con la contraseña `FutOwl#2026!` (cámbiela con `--password`). **No use datos demo en producción.**

## Flujo del torneo

1. **Crear el torneo** (modalidad, categorías, canchas, reglas, puntuación, documentos).
2. **Inscribir equipos** por categoría y, si aplica, asignarlos a **grupos**.
3. **Generar partidos** (todos contra todos, ida y vuelta opcional) o crearlos manualmente.
4. **Armar la jornada**: día, partido, cancha, horario, delegado y terna arbitral.
   - La jornada queda en **borrador** hasta que todos los campos estén completos.
   - **Sin solapamientos**: una cancha admite tantos partidos simultáneos como su capacidad
     (mini canchas si es divisible; se asigna la mini cancha libre). Tampoco se permite que un
     delegado, árbitro o equipo esté en dos partidos a la vez.
5. **Enviar la jornada**: las asignaciones se bloquean y se notifica a los involucrados.
   - Delegado y árbitros **confirman o rechazan** (con motivo). Al confirmar, su selección queda bloqueada.
   - Cuando delegado y terna confirman, el partido queda **válido** y se notifica que se llevará a cabo.
     La confirmación de los equipos es deseable pero opcional.
   - Un **rechazo** pasa a **revisión** de las autoridades.
   - Cualquier cambio posterior es un **ajuste con exposición de motivos**: se guarda el antes/después,
     no se borra lo anterior y las partes afectadas deben reconfirmar.
6. **Alineaciones**: antes de la jornada cada equipo carga su alineación (o **importa** la planilla
   `.docx`/`.csv` exportada por FutOwl) y puede descargar la documentación del torneo.
7. **Mesa técnica** (delegado, en tiempo real):
   llegada del delegado → llegada de equipos → verificación de documentos → inicio →
   incidencias (goles, tarjetas, cambios…) → fin de tiempo / partido.
   La información pública se ve al instante en la web.
8. **Cierre**: delegado y árbitro envían sus informes; **deben coincidir**. Solo una autoridad puede
   devolver un informe para corrección (nueva versión) y cerrar el partido. Cerrados todos los partidos,
   se **cierra la jornada**. Después solo se admiten **notas o apelaciones** (que pasan a revisión).

## Modelos

| Modelo | Campos destacados |
|--------|-------------------|
| **Equipo** | nombre, RIF (`vat_id` V/E/J/G + `vat_number`), logo, ubicación (país, estado, municipio, dirección), categorías, cancha, entrenadores, gestores, nómina por categoría |
| **Entrenador** | nombre, cédula (+ foto), teléfono, licencia (+ foto y año de vencimiento), foto |
| **Jugador** | nombre, cédula o partida de nacimiento (+ foto), fecha de nacimiento, **edad calculada**, foto, teléfono, **representante obligatorio si es menor de 18** |
| **Representante** | nombre, cédula, teléfono, parentesco |
| **Torneo** | nombre, logo, modalidad, categorías, canchas, reglas, planilla de alineación, tarjetas de cambio, reglamento (texto o archivo) |
| **Cancha** | nombre, dirección, responsable, teléfono, medidas (largo/alto y ancho), divisible, cantidad de mini canchas |
| **Delegado / Árbitro** | nombre, cédula (+ foto), licencia (avalado / no avalado), teléfono, usuario vinculado |
| **Categoría** | nombre (Sub 12), tope de edad (11), tope de año de nacimiento (2015) |

La elegibilidad de un jugador en una categoría se valida por **año de nacimiento**.

## Seguridad

- **Cifrado en base de datos**: cédulas/RIF y teléfonos se guardan cifrados (Fernet: AES + HMAC).
  Para búsquedas y unicidad se usa un **índice ciego** (HMAC-SHA256), nunca el dato en claro.
- **Cifrado en tránsito**: HTTPS obligatorio, HSTS, cookies `Secure`.
- **Sesión segura**: JWT de vida corta **solo en memoria** + refresh token en **cookie httpOnly**
  (`SameSite=Strict`), rotación y lista negra al cerrar sesión.
- **Fuerza bruta**: límite de intentos por IP y **bloqueo temporal** de la cuenta tras N fallos.
- **Inyección SQL**: todo el acceso a datos usa el ORM parametrizado de Django (sin SQL crudo).
- **Archivos** (protección contra malware disfrazado): validación de extensión, tamaño, **firma binaria real**
  (magic bytes), patrones peligrosos (ejecutables/scripts) y verificación de imágenes; los nombres se
  reemplazan por UUID.
- **Cabeceras**: CSP estricta, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`.
- **Supabase**: una migración activa **Row Level Security** en todas las tablas para que la API REST
  pública de Supabase no exponga datos (Django se conecta como propietario).
- **Decoradores** de protección para APIs y funciones: `@require_perms(...)`, `@require_authenticated`.
- **Términos y condiciones**: la API exige aceptar la versión vigente antes de operar.

## Inalterabilidad y auditoría

- Registros maestros: **no se borran**, se desactivan/reactivan (y queda auditado).
- Operaciones confirmadas (`MatchEvent`, `MatchConfirmation`, `MatchAdjustment`, `MatchReport`,
  `ReportReturn`, `MatchClosure`, `MatchNote`, términos y aceptaciones) son **solo inserción**:
  - En la aplicación: el modelo rechaza `save()` sobre registros existentes, `delete()` y `update()` masivo.
  - En PostgreSQL: **triggers** que bloquean `UPDATE`/`DELETE` incluso por SQL directo.
- Las correcciones se hacen con nuevos asientos: **anulación** de eventos (con motivo), **ajustes**,
  **devoluciones** de informes, **notas/apelaciones**.
- **Bitácora** (`AuditLog`): cada alta, modificación (con diff antes/después), inicio de sesión,
  exportación, confirmación, evento y cierre queda registrado con usuario, IP, agente y hora.
  Cada asiento encadena el **hash SHA-256** del anterior; la verificación de integridad detecta
  cualquier alteración (`GET /api/audit-logs/verify/`).

## Roles y permisos

Roles predefinidos (`python manage.py seed_roles`):

| Rol | Alcance |
|-----|---------|
| Administrador | Todos los permisos |
| Autoridad | Registro, torneos, competición, revisiones, cierres, auditoría |
| Delegado | Consulta, confirmar asignación, **operar mesa técnica** de sus partidos, informe del delegado |
| Árbitro | Consulta, confirmar asignación, informe arbitral |
| Gestor de equipo | Consulta, nómina y jugadores de sus equipos, alineaciones, confirmar asistencia |
| Consulta | Solo lectura |

Además de los roles, cada usuario puede recibir **permisos personalizados**. Desde la interfaz
(*Administración → Roles y permisos*) se crean roles nuevos con cualquier combinación. Todas las
funciones de la aplicación tienen su permiso (p. ej. `competition.operate_match`,
`competition.close_match`, `competition.adjust_match`, `competition.resolve_reviewcase`…).

## Hora oficial (UTC-4) y tiempo real

- Backend: `TIME_ZONE = "America/Caracas"`; todas las fechas se almacenan en UTC y se presentan en hora de Venezuela.
- Frontend: el **reloj del encabezado se sincroniza con el servidor** (`/api/time/`), compensando la
  latencia, y se re-sincroniza periódicamente. Los formularios de fecha/hora trabajan en UTC-4.
- Tiempo real: los marcadores, la cronología, la mesa técnica, las posiciones y las notificaciones se
  actualizan automáticamente (consulta periódica de 3–30 s, pausada cuando la pestaña no está visible).
  Este enfoque es compatible con funciones serverless de Vercel.

## Documentos (exportar / importar)

| Documento | Exportar | Importar |
|-----------|----------|----------|
| Planilla de alineación | PDF y Word, generada con la nómina (y la alineación del partido si existe) | La planilla `.docx` (o `.csv`) marcada con “X” se importa en la alineación; también se puede adjuntar la planilla firmada |
| Tarjetas de cambio | PDF y Word | Plantilla propia del torneo (Word/PDF) |
| Reglamento | PDF y Word desde el texto escrito en la app | Archivo Word/PDF |

## API

Prefijo `/api/`. Autenticación `Authorization: Bearer <access>`.

| Recurso | Ruta |
|---------|------|
| Autenticación | `auth/login/`, `auth/refresh/`, `auth/logout/`, `auth/me/`, `auth/change-password/` |
| Términos | `legal/terms/current/`, `legal/terms/accept/`, `legal/terms/publish/` |
| Registro | `categories/`, `fields/`, `coaches/`, `guardians/`, `players/`, `delegates/`, `referees/`, `teams/`, `roster/` |
| Torneos | `tournaments/` (+ `documents/lineup-sheet/`, `documents/substitution-cards/`, `documents/regulation/`), `groups/`, `registrations/` |
| Competición | `matchdays/` (+ `completeness`, `submit`, `close`), `matches/` (+ `generate-fixture`, `confirmations`, `respond`, `adjust`, `suspend`, `lineups`, `submit-lineup`, `import-lineup`, `events`, `record-event`, `state`, `reports`, `submit-report`, `return-report`, `close`, `notes`, `add-note`), `review-cases/`, `standings/` |
| Administración | `users/`, `roles/`, `permissions/`, `audit-logs/` (+ `verify`) |
| Pública (sin login) | `public/tournaments/…`, `public/matches/live/`, `public/matches/<id>/` |
| Utilidades | `time/`, `health/` |

## Despliegue: Vercel + Supabase

Un único proyecto de Vercel (raíz del repo) sirve el build de Vite y Django como función
Python (`api/index.py`). `/api/*` y `/media/*` van a Django en **el mismo dominio**, así que la
cookie httpOnly funciona con `SameSite=Strict` y no hace falta CORS. Cada despliegue acepta
automáticamente su propio dominio (`VERCEL_URL`, `VERCEL_BRANCH_URL`, `VERCEL_PROJECT_PRODUCTION_URL`).

| Rama | Entorno Vercel | Esquema Supabase | Rol de BD | Bucket |
|------|----------------|------------------|-----------|--------|
| `master` | Production | `public` | `futowl_prod` | `futowl` |
| `develop` (y cualquier otra rama) | Preview | `qa` | `futowl_qa` | `futowl-qa` |

Un único proyecto Supabase (`futowl`, us-east-1). El esquema lo fija el `search_path` de cada rol
(`ALTER ROLE … SET search_path`), no la aplicación: `futowl_qa` no tiene privilegios en `public`,
de modo que un preview **no puede** tocar datos de producción. Las tablas de ambos esquemas tienen
RLS activo y no son visibles para los roles `anon`/`authenticated` de la API REST de Supabase.

### Variables de entorno (Vercel → Settings → Environment Variables)

Cada entorno (Production / Preview) tiene sus **propios** valores; están en los archivos locales
`.env.vercel.production` y `.env.vercel.preview` (ignorados por git, permisos 600):

```
DJANGO_SETTINGS_MODULE=config.settings.production
DJANGO_SECRET_KEY · FIELD_ENCRYPTION_KEY · BLIND_INDEX_KEY · JWT_SIGNING_KEY
DJANGO_ADMIN_URL=api/<ruta-secreta>/        # bajo api/ para que llegue a Django
DATABASE_URL=postgresql://<rol>.<ref>:<password>@aws-0-us-east-1.pooler.supabase.com:6543/postgres
DB_SSL_REQUIRE=true
SUPABASE_S3_ENDPOINT · SUPABASE_S3_BUCKET · SUPABASE_S3_REGION · SUPABASE_S3_ACCESS_KEY · SUPABASE_S3_SECRET_KEY
```

`DB_ROLE` y `DB_PASSWORD` de esos archivos son solo de referencia (ya van dentro de `DATABASE_URL`).

> ⚠️ Guarde `FIELD_ENCRYPTION_KEY` de cada entorno en un gestor de contraseñas: sin ella los datos
> cifrados no se pueden recuperar.

### Migraciones

Vercel no ejecuta migraciones. Antes de desplegar cambios de modelos, desde su equipo:

```bash
make remote-migrate REMOTE_ENV=preview      # esquema qa
make remote-migrate REMOTE_ENV=production   # esquema public
make remote-superuser REMOTE_ENV=production
```

## Pruebas

```bash
cd backend && DJANGO_SETTINGS_MODULE=config.settings.test python manage.py test apps
cd frontend && npm run typecheck && npm test && npm run build
```

Las pruebas cubren el flujo completo de una jornada (envío, rechazo, ajuste, confirmaciones,
alineaciones, mesa técnica, anulaciones, doble amarilla, informes, devolución, cierre y API pública),
solapamiento de canchas divisibles, permisos, cifrado en reposo, cadena de auditoría, inmutabilidad,
bloqueo de cuentas, cookies de sesión, aceptación de términos, validación de archivos y la
exportación/importación de la planilla.

---

**Aviso legal**: consulte los [Términos y condiciones](backend/apps/legal/terms_v1.md). El software se
ofrece “tal cual”; la organización de cada torneo es responsable de los datos y decisiones tomadas con él.
