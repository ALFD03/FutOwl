import { useState, type FormEvent } from "react";
import { KeyRound, UserCog } from "lucide-react";

import { Alert, Avatar, Badge, Card, CardHeader, KeyValue, PageHeader, Spinner } from "@/components/ui";
import { useAuth, useToast } from "@/hooks";
import { auth } from "@/services";
import { errorMessage } from "@/utils/errors";

export function ProfilePage() {
  const { user, reload } = useAuth();
  const toast = useToast();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (!user) return null;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (next !== confirm) return setError("Las contraseñas no coinciden.");
    setBusy(true);
    setError(null);
    try {
      await auth.changePassword(current, next);
      toast.success("Contraseña actualizada.");
      setCurrent(""); setNext(""); setConfirm("");
      await reload();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageHeader title="Mi cuenta" icon={<UserCog className="h-6 w-6" />} />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <div className="flex items-center gap-4 p-6">
            <Avatar name={`${user.first_name || user.username} ${user.last_name}`} size="xl" />
            <div>
              <h2 className="text-xl font-bold">{user.first_name} {user.last_name}</h2>
              <p className="text-sm text-slate-500">@{user.username} · {user.email}</p>
              <div className="mt-2 flex flex-wrap gap-1">{user.is_superuser && <Badge tone="gold">Superusuario</Badge>}{user.groups.map((g) => <Badge key={g} tone="navy">{g}</Badge>)}</div>
            </div>
          </div>
          <div className="border-t border-slate-100 p-6 dark:border-white/5">
            <KeyValue items={[
              { label: "Perfil de delegado", value: user.profiles.delegate_id ? "Vinculado" : "No" },
              { label: "Perfil de árbitro", value: user.profiles.referee_id ? "Vinculado" : "No" },
              { label: "Equipos que gestiona", value: user.profiles.team_ids.length },
              { label: "Permisos efectivos", value: user.is_superuser ? "Todos" : user.permissions.length },
            ]} />
          </div>
        </Card>
        <Card>
          <CardHeader title="Cambiar contraseña" icon={<KeyRound className="h-5 w-5" />} />
          <form className="card-body space-y-4" onSubmit={submit}>
            {user.must_change_password && <Alert tone="warning">Debe cambiar su contraseña.</Alert>}
            {error && <Alert tone="danger">{error}</Alert>}
            <div><label className="label">Contraseña actual</label><input type="password" className="input" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} required /></div>
            <div><label className="label">Nueva contraseña</label><input type="password" className="input" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} required minLength={10} />
              <p className="help">Mínimo 10 caracteres; no puede ser común ni solo números.</p></div>
            <div><label className="label">Confirmar</label><input type="password" className="input" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required /></div>
            <button className="btn-primary" disabled={busy}>{busy && <Spinner className="h-4 w-4" />}Actualizar</button>
          </form>
        </Card>
      </div>
    </div>
  );
}
