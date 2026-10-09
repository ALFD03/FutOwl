import { useState, type FormEvent } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { Eye, EyeOff, Lock, LogIn, User } from "lucide-react";

import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { Alert, Spinner } from "@/components/ui";
import { useAuth } from "@/hooks";
import { errorMessage } from "@/utils/errors";

export function LoginPage() {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const from = (location.state as { from?: string } | null)?.from ?? "/app";

  if (user) return <Navigate to={from} replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const me = await login(username.trim(), password);
      navigate(me.terms_accepted ? from : "/aceptar-terminos", { replace: true });
    } catch (err) {
      setError(errorMessage(err, "No se pudo iniciar sesión."));
      setPassword("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-navy-950 lg:block">
        <img src="/brand/banner-logo.jpg" alt="" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-navy-950 via-navy-950/30 to-transparent" />
        <div className="absolute bottom-10 left-10 right-10 text-white">
          <p className="font-display text-2xl font-bold">Gestión profesional de torneos</p>
          <p className="mt-2 max-w-md text-slate-300">Resultados en tiempo real, trazabilidad total y seguridad en cada operación.</p>
        </div>
      </div>
      <div className="flex flex-col">
        <div className="flex justify-between p-4"><Link to="/" className="btn-ghost">← Volver al sitio</Link><ThemeToggle /></div>
        <div className="flex flex-1 items-center justify-center px-4 pb-16">
          <form onSubmit={submit} className="w-full max-w-sm animate-slide-up">
            <img src="/brand/logo.png" alt="FutOwl" className="mx-auto mb-6 h-36 w-auto" />
            <h1 className="text-center text-2xl font-bold text-slate-900 dark:text-white">Iniciar sesión</h1>
            <p className="mb-6 text-center text-sm text-slate-500">Acceso seguro con token cifrado</p>
            {error && <div className="mb-4"><Alert tone="danger">{error}</Alert></div>}
            <label className="label" htmlFor="username">Usuario</label>
            <div className="relative mb-4">
              <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input id="username" className="input pl-9" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} required maxLength={150} autoFocus />
            </div>
            <label className="label" htmlFor="password">Contraseña</label>
            <div className="relative mb-6">
              <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input id="password" type={show ? "text" : "password"} className="input px-9" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required maxLength={128} />
              <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600" aria-label="Mostrar contraseña">
                {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <button type="submit" className="btn-primary w-full py-2.5" disabled={busy || !username || !password}>
              {busy ? <Spinner className="h-4 w-4" /> : <LogIn className="h-4 w-4" />} Entrar
            </button>
            <p className="mt-6 text-center text-xs text-slate-500">
              Al ingresar acepta los <Link to="/terminos" className="font-semibold text-navy-700 underline dark:text-gold-400">términos y condiciones</Link>.
              Tras 5 intentos fallidos la cuenta se bloquea temporalmente.
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
