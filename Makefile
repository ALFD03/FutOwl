# =============================================================================
# FutOwl · comandos rápidos de desarrollo
#   make            → muestra esta ayuda
#   make setup      → instala todo y prepara la base de datos con datos demo
#   make dev        → levanta backend (8000) y frontend (5173) a la vez
# =============================================================================

SHELL := /bin/bash
.DEFAULT_GOAL := help

BACKEND  := backend
FRONTEND := frontend
VENV     ?= $(BACKEND)/.venv
PY       := $(abspath $(VENV))/bin/python
PIP      := $(abspath $(VENV))/bin/pip
MANAGE   := cd $(BACKEND) && $(PY) manage.py
TEST_ENV := DJANGO_SETTINGS_MODULE=config.settings.test

HOST          ?= 127.0.0.1
BACKEND_PORT  ?= 8000
FRONTEND_PORT ?= 5173
DEMO_PASSWORD ?= FutOwl\#2026!

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
setup: install env migrate demo ## Instala todo, migra y carga datos demo (primera vez)
	@echo -e "\n\033[32m✔ Listo. Ejecute 'make dev' y abra http://localhost:$(FRONTEND_PORT)\033[0m"

install: install-backend install-frontend ## Instala dependencias de backend y frontend

install-backend: ## Crea el entorno virtual e instala requirements.txt
	@test -x $(PY) || python3 -m venv $(VENV)
	$(PIP) install -q --upgrade pip
	$(PIP) install -q -r $(BACKEND)/requirements.txt

install-frontend: ## Instala dependencias de npm
	cd $(FRONTEND) && npm install --no-audit --no-fund

env: ## Crea los .env a partir de los ejemplos (no sobrescribe) y genera claves
	@if [ ! -f $(BACKEND)/.env ]; then \
		cp $(BACKEND)/.env.example $(BACKEND)/.env; \
		KEY=$$($(PY) -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"); \
		SECRET=$$($(PY) -c "import secrets; print(secrets.token_urlsafe(50))"); \
		sed -i.bak "s|^FIELD_ENCRYPTION_KEY=.*|FIELD_ENCRYPTION_KEY=$$KEY|; s|^DJANGO_SECRET_KEY=.*|DJANGO_SECRET_KEY=$$SECRET|" $(BACKEND)/.env && rm -f $(BACKEND)/.env.bak; \
		echo "✔ $(BACKEND)/.env creado con claves nuevas"; \
	else echo "• $(BACKEND)/.env ya existe"; fi
	@if [ ! -f $(FRONTEND)/.env ]; then cp $(FRONTEND)/.env.example $(FRONTEND)/.env && echo "✔ $(FRONTEND)/.env creado"; \
	else echo "• $(FRONTEND)/.env ya existe"; fi

##@ Desarrollo
.PHONY: dev backend frontend shell
dev: ## Levanta backend y frontend juntos (Ctrl+C detiene ambos)
	@echo -e "\033[36mBackend  → http://$(HOST):$(BACKEND_PORT)/api/\033[0m"
	@echo -e "\033[36mFrontend → http://localhost:$(FRONTEND_PORT)\033[0m"
	@trap 'kill 0' INT TERM EXIT; \
		($(MANAGE) runserver $(HOST):$(BACKEND_PORT)) & \
		(cd $(FRONTEND) && npx vite --port $(FRONTEND_PORT)) & \
		wait

backend: ## Solo el backend Django (puerto 8000)
	$(MANAGE) runserver $(HOST):$(BACKEND_PORT)

frontend: ## Solo el frontend Vite (puerto 5173)
	cd $(FRONTEND) && npx vite --port $(FRONTEND_PORT)

shell: ## Shell interactiva de Django
	$(MANAGE) shell

##@ Base de datos
.PHONY: migrate migrations roles demo superuser reset-db secure-db
migrate: ## Aplica migraciones y sincroniza roles
	$(MANAGE) migrate
	$(MANAGE) seed_roles

migrations: ## Genera migraciones nuevas tras cambiar modelos
	$(MANAGE) makemigrations

roles: ## Crea/actualiza los roles predefinidos y sus permisos
	$(MANAGE) seed_roles

demo: ## Carga datos de demostración (usuarios, torneo y partido en vivo)
	$(MANAGE) seed_demo --password "$(DEMO_PASSWORD)"

superuser: ## Crea un superusuario
	$(MANAGE) createsuperuser

reset-db: ## ⚠ Borra la base SQLite local y la recrea con datos demo
	@read -p "Se borrará $(BACKEND)/db.sqlite3. ¿Continuar? [s/N] " ok && [ "$$ok" = "s" ]
	rm -f $(BACKEND)/db.sqlite3
	$(MAKE) --no-print-directory migrate demo

secure-db: ## Reaplica RLS y triggers de inalterabilidad (solo PostgreSQL/Supabase)
	$(MANAGE) secure_database

##@ Despliegue (Supabase: esquema qa = previews/develop, public = producción/master)
.PHONY: remote-migrate remote-superuser remote-shell
REMOTE_ENV  ?= preview
REMOTE_FILE := $(abspath .env.vercel.$(REMOTE_ENV))
REMOTE      := set -a && source $(REMOTE_FILE) && set +a && cd $(BACKEND) && $(PY) manage.py

remote-migrate: ## Migra y sincroniza roles en Supabase (REMOTE_ENV=preview|production)
	@test -f $(REMOTE_FILE) || { echo "Falta $(REMOTE_FILE)"; exit 1; }
	$(REMOTE) migrate
	$(REMOTE) seed_roles

remote-superuser: ## Crea un superusuario en Supabase (REMOTE_ENV=preview|production)
	$(REMOTE) createsuperuser

remote-shell: ## Shell de Django contra Supabase (REMOTE_ENV=preview|production)
	$(REMOTE) shell

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
