# =============================================================================
# FutOwl · comandos rápidos de desarrollo
#   make            → muestra esta ayuda
#   make setup      → instala dependencias y verifica los .env.vercel.* (no toca ninguna base de datos)
#   make dev        → levanta backend (8000) y frontend (5173) contra el esquema qa de Supabase y el bucket qa,
#                     con la misma configuración que producción (puertos ocupados → propone otros)
#
# No hay base de datos local: en local siempre se trabaja sobre qa, igual que los previews.
# Los comandos de base de datos usan ENV=preview (qa, por defecto) o ENV=production (public; pide confirmación).
# =============================================================================

SHELL := /bin/bash
.DEFAULT_GOAL := help

BACKEND  := backend
FRONTEND := frontend
VENV     ?= $(BACKEND)/.venv
PY       := $(abspath $(VENV))/bin/python
PIP      := $(abspath $(VENV))/bin/pip
TEST_ENV := DJANGO_SETTINGS_MODULE=config.settings.test

HOST          ?= 127.0.0.1
BACKEND_PORT  ?= 8000
FRONTEND_PORT ?= 5173

# Entorno de Supabase: preview → esquema qa + bucket futowl-qa · production → esquema public + bucket futowl
ENV ?= preview
ifeq ($(filter $(ENV),preview production),)
$(error ENV debe ser preview o production)
endif
ENV_FILE := $(abspath .env.vercel.$(ENV))
# Mismas variables que Vercel (settings de producción); solo se permite http para servir en localhost.
DJ := { test -f $(ENV_FILE) || { echo "Falta $(ENV_FILE) (ver make env)"; exit 1; }; } && \
	set -a && source $(ENV_FILE) && set +a && export SECURE_SSL_REDIRECT=false && cd $(BACKEND) && $(PY) manage.py
# Línea propia en cada receta: si la respuesta no es "s", make se detiene antes de tocar producción.
CONFIRM := $(if $(filter production,$(ENV)),read -p "⚠ Se ejecutará contra PRODUCCIÓN (esquema public). ¿Continuar? [s/N] " ok && [ "$$ok" = "s" ],true)
REQUIRED_VARS := DJANGO_SETTINGS_MODULE DJANGO_SECRET_KEY FIELD_ENCRYPTION_KEY BLIND_INDEX_KEY JWT_SIGNING_KEY DATABASE_URL \
	SUPABASE_S3_ENDPOINT SUPABASE_S3_BUCKET SUPABASE_S3_REGION SUPABASE_S3_ACCESS_KEY SUPABASE_S3_SECRET_KEY

# ---------------------------------------------------------------------- Ayuda
.PHONY: help
help: ## Muestra los comandos disponibles
	@echo ""
	@echo "  FutOwl · comandos disponibles"
	@echo ""
	@awk 'BEGIN {FS = ":.*## "} /^##@/ {printf "\n  \033[1;33m%s\033[0m\n", substr($$0, 5)} /^[a-zA-Z0-9_-]+:.*## / {printf "    \033[36m%-18s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)
	@echo ""

##@ Instalación
.PHONY: setup install install-backend install-frontend env
setup: install env ## Instala dependencias y verifica los .env.vercel.* (no toca ninguna base de datos)
	@echo -e "\n\033[32m✔ Listo. Ejecute 'make dev' (esquema qa) y abra http://localhost:$(FRONTEND_PORT)\033[0m"

install: install-backend install-frontend ## Instala dependencias de backend y frontend

install-backend: ## Crea el entorno virtual e instala requirements.txt
	@test -x $(PY) || python3 -m venv $(VENV)
	$(PIP) install -q --upgrade pip
	$(PIP) install -q -r $(BACKEND)/requirements.txt

install-frontend: ## Instala dependencias de npm
	cd $(FRONTEND) && npm install --no-audit --no-fund

env: ## Verifica .env.vercel.preview/.production (secretos de qa y producción) y crea frontend/.env
	@if [ ! -f $(FRONTEND)/.env ]; then cp $(FRONTEND)/.env.example $(FRONTEND)/.env && echo "✔ $(FRONTEND)/.env creado"; fi
	@ok=1; for f in .env.vercel.preview .env.vercel.production; do \
		if [ ! -f $$f ]; then echo "✘ Falta $$f"; ok=0; continue; fi; \
		missing=""; for k in $(REQUIRED_VARS); do grep -Eq "^$$k=.+" $$f || missing="$$missing $$k"; done; \
		if [ -n "$$missing" ]; then echo "✘ $$f sin:$$missing"; ok=0; else echo "✔ $$f completo"; fi; \
	done; \
	if [ $$ok = 0 ]; then echo "  Pida los valores al responsable del proyecto: los secretos de Vercel no se pueden descargar."; exit 1; fi

##@ Desarrollo (siempre contra qa)
.PHONY: dev backend frontend shell
dev: ## Backend + frontend contra qa (base y bucket); si un puerto está ocupado pregunta otro
	@HOST=$(HOST) BACKEND_PORT=$(BACKEND_PORT) FRONTEND_PORT=$(FRONTEND_PORT) PY=$(PY) \
		BACKEND=$(BACKEND) FRONTEND=$(FRONTEND) ENV_FILE=$(abspath .env.vercel.preview) bash scripts/dev.sh

backend: ## Solo el backend Django contra qa (puerto 8000)
	@$(MAKE) --no-print-directory _backend ENV=preview

_backend:
	@$(DJ) runserver $(HOST):$(BACKEND_PORT)

frontend: ## Solo el frontend Vite (puerto 5173, proxy /api → backend :8000)
	cd $(FRONTEND) && npx vite --port $(FRONTEND_PORT)

shell: ## Shell de Django (ENV=preview|production)
	@$(CONFIRM)
	@$(DJ) shell

##@ Base de datos en Supabase (ENV=preview → qa por defecto · ENV=production → public)
.PHONY: migrate migrations roles superuser docs secure-db
migrate: ## Aplica migraciones y sincroniza roles
	@$(CONFIRM)
	@$(DJ) migrate
	@$(DJ) seed_roles

migrations: ## Genera migraciones nuevas tras cambiar modelos (no se conecta a Supabase)
	cd $(BACKEND) && $(TEST_ENV) $(PY) manage.py makemigrations

roles: ## Crea/actualiza los roles predefinidos y sus permisos
	@$(CONFIRM)
	@$(DJ) seed_roles

superuser: ## Crea un superusuario
	@$(CONFIRM)
	@$(DJ) createsuperuser

docs: ## Recarga la documentación base desde apps/docs/content (queda una revisión por página)
	@$(CONFIRM)
	@$(DJ) load_docs --overwrite

secure-db: ## Reaplica RLS y triggers de inalterabilidad
	@$(CONFIRM)
	@$(DJ) secure_database

##@ Pruebas y calidad
.PHONY: test test-backend test-frontend typecheck check check-deploy ci
test: test-backend test-frontend ## Ejecuta todas las pruebas

test-backend: ## Pruebas de Django (usa T=ruta para filtrar, p. ej. T=apps.core)
	cd $(BACKEND) && $(TEST_ENV) $(PY) manage.py test $(or $(T),apps)

test-frontend: ## Pruebas unitarias del frontend (Vitest)
	cd $(FRONTEND) && npm test

typecheck: ## Verificación de tipos TypeScript
	cd $(FRONTEND) && npm run typecheck

check: ## Chequeos de Django y migraciones pendientes
	cd $(BACKEND) && $(TEST_ENV) $(PY) manage.py check
	cd $(BACKEND) && $(TEST_ENV) $(PY) manage.py makemigrations --check --dry-run

check-deploy: ## Revisa la configuración de producción (requiere variables de producción)
	cd $(BACKEND) && DJANGO_SETTINGS_MODULE=config.settings.production $(PY) manage.py check --deploy

ci: check test typecheck build ## Lo mismo que corre en GitHub Actions

##@ Build y utilidades
.PHONY: build preview keys clean clean-all
build: ## Compila el frontend para producción (frontend/dist)
	cd $(FRONTEND) && npm run build

preview: build ## Sirve el build de producción del frontend
	cd $(FRONTEND) && npx vite preview --port 4173

keys: ## Genera claves seguras para las variables de entorno de producción
	@echo "DJANGO_SECRET_KEY=$$($(PY) -c 'import secrets; print(secrets.token_urlsafe(50))')"
	@echo "FIELD_ENCRYPTION_KEY=$$($(PY) -c 'from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())')"
	@echo "BLIND_INDEX_KEY=$$($(PY) -c 'import secrets; print(secrets.token_urlsafe(40))')"
	@echo "JWT_SIGNING_KEY=$$($(PY) -c 'import secrets; print(secrets.token_urlsafe(40))')"

clean: ## Elimina cachés y artefactos de build
	find $(BACKEND) -type d -name __pycache__ -prune -exec rm -rf {} +
	rm -rf $(BACKEND)/staticfiles $(BACKEND)/test_media $(FRONTEND)/dist $(FRONTEND)/node_modules/.tmp

clean-all: clean ## Además elimina el entorno virtual y node_modules
	rm -rf $(VENV) $(FRONTEND)/node_modules
