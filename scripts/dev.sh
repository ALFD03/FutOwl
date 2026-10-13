#!/usr/bin/env bash
# =============================================================================
# FutOwl · levanta backend y frontend juntos (lo usa `make dev`).
#   Si un puerto está ocupado, propone el siguiente libre y permite escribir otro.
#   Sin terminal interactiva (CI, pipes) usa directamente el puerto propuesto.
#
#   Variables: HOST, BACKEND_PORT, FRONTEND_PORT, PY (python del venv), BACKEND, FRONTEND
# =============================================================================
set -euo pipefail

HOST=${HOST:-127.0.0.1}
BACKEND_PORT=${BACKEND_PORT:-8000}
FRONTEND_PORT=${FRONTEND_PORT:-5173}
BACKEND=${BACKEND:-backend}
FRONTEND=${FRONTEND:-frontend}
PY=${PY:-$BACKEND/.venv/bin/python}

# ¿Hay algo escuchando en el puerto? (IPv4 o IPv6: Vite suele escuchar en ::1)
port_busy() {
  local port=$1
  if command -v ss >/dev/null 2>&1; then
    ss -Htln "sport = :$port" 2>/dev/null | grep -q .
  else
    (exec 3<>"/dev/tcp/127.0.0.1/$port") 2>/dev/null || (exec 3<>"/dev/tcp/::1/$port") 2>/dev/null
  fi
}

# Proceso que ocupa el puerto, si se puede saber.
port_owner() {
  local port=$1
  if command -v lsof >/dev/null 2>&1; then
    lsof -nP -iTCP:"$port" -sTCP:LISTEN 2>/dev/null | awk 'NR == 2 {print $1 " (PID " $2 ")"}'
  elif command -v ss >/dev/null 2>&1; then
    ss -Htlnp "sport = :$port" 2>/dev/null | grep -o 'users:(("[^"]*",pid=[0-9]*' | head -1 | sed 's/users:(("\(.*\)",pid=\(.*\)/\1 (PID \2)/'
  fi
}

next_free_port() {
  local port=$(( $1 + 1 ))
  while port_busy "$port" || [ "$port" = "${2:-}" ]; do port=$(( port + 1 )); done
  echo "$port"
}

# choose_port <nombre> <puerto> [puerto ya reservado] → imprime el puerto elegido
choose_port() {
  local name=$1 port=$2 taken=${3:-}
  if ! port_busy "$port" && [ "$port" != "$taken" ]; then echo "$port"; return; fi

  local owner suggestion answer
  owner=$(port_owner "$port")
  suggestion=$(next_free_port "$port" "$taken")
  echo -e "\033[33m⚠ El puerto $port ($name) está ocupado${owner:+ por $owner}.\033[0m" >&2

  if [ ! -t 0 ]; then
    echo "  → se usará el $suggestion" >&2
    echo "$suggestion"; return
  fi
  while true; do
    read -r -p "  Puerto para el $name [$suggestion]: " answer </dev/tty
    answer=${answer:-$suggestion}
    if ! [[ $answer =~ ^[0-9]+$ ]] || (( answer < 1024 || answer > 65535 )); then
      echo "  Escriba un número entre 1024 y 65535." >&2
    elif [ "$answer" = "$taken" ]; then
      echo "  El $answer ya está asignado al backend." >&2
    elif port_busy "$answer"; then
      echo "  El $answer también está ocupado." >&2
      suggestion=$(next_free_port "$answer" "$taken")
    else
      echo "$answer"; return
    fi
  done
}

BACKEND_PORT=$(choose_port backend "$BACKEND_PORT")
FRONTEND_PORT=$(choose_port frontend "$FRONTEND_PORT" "$BACKEND_PORT")

echo -e "\033[36mBackend  → http://$HOST:$BACKEND_PORT/api/\033[0m"
echo -e "\033[36mFrontend → http://localhost:$FRONTEND_PORT\033[0m"

trap 'kill 0' INT TERM EXIT
# FRONTEND_PORT: Django confía en ese origen (CSRF/CORS). VITE_DEV_API_TARGET: destino del proxy de Vite.
(cd "$BACKEND" && FRONTEND_PORT=$FRONTEND_PORT "$PY" manage.py runserver "$HOST:$BACKEND_PORT") &
(cd "$FRONTEND" && VITE_DEV_API_TARGET="http://$HOST:$BACKEND_PORT" npx vite --port "$FRONTEND_PORT" --strictPort) &
wait
