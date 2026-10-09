"""
Punto de entrada de Vercel: expone la app WSGI de Django como función Python.

Las reglas de `vercel.json` reenvían `/api/*` y `/media/*` aquí conservando la ruta original.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "backend"))

from config.wsgi import app  # noqa: E402,F401
