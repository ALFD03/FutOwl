import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { KeyRound, Plus, Save } from "lucide-react";

import { PermissionPicker } from "@/components/forms";
import { Can } from "@/components/layout/Guards";
import { Card, CardHeader, EmptyState, PageHeader, Spinner } from "@/components/ui";
import { useCan, useToast } from "@/hooks";
import { roles } from "@/services";
import type { Role } from "@/types";
import { cn } from "@/utils/cn";
import { errorMessage } from "@/utils/errors";

export function RolesPage() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const canChange = useCan("auth.change_group");
  const rolesQ = useQuery({ queryKey: ["roles", "all"], queryFn: () => roles.all() });
  const [selected, setSelected] = useState<Role | null>(null);
  const [checked, setChecked] = useState<number[]>([]);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setChecked(selected?.permissions ?? []);
    setName(selected?.name ?? "");
  }, [selected]);

  const save = async () => {
    setBusy(true);
    try {
      const payload = { name, permissions: checked };
      const saved = selected?.id ? await roles.update(selected.id, payload) : await roles.create(payload);
      toast.success("Rol guardado. El cambio quedó auditado.");
      await queryClient.invalidateQueries({ queryKey: ["roles"] });
      setSelected(saved);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageHeader title="Roles y permisos" subtitle="Permisos por grupo; además, cada usuario puede tener permisos personalizados" icon={<KeyRound className="h-6 w-6" />}
        actions={<Can perm="auth.add_group"><button className="btn-gold" onClick={() => setSelected({ id: 0, name: "", permissions: [], user_count: 0 })}><Plus className="h-4 w-4" /> Nuevo rol</button></Can>} />
      <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
        <Card className="h-fit">
          <CardHeader title="Roles" />
          <ul className="p-2">
            {(rolesQ.data ?? []).map((r) => (
              <li key={r.id}>
                <button onClick={() => setSelected(r)} className={cn("flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm transition",
                  selected?.id === r.id ? "bg-navy-900 text-white dark:bg-gold-500 dark:text-navy-950" : "hover:bg-slate-100 dark:hover:bg-white/5")}>
                  <span className="font-semibold">{r.name}</span><span className="text-xs opacity-70">{r.permissions.length} · {r.user_count} usr</span>
                </button>
              </li>
            ))}
          </ul>
        </Card>
        {!selected ? <Card><EmptyState title="Seleccione un rol" message="Elija un rol para ver y editar sus permisos." /></Card> : (
          <Card>
            <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center dark:border-white/5">
              <div className="flex-1">
                <label className="label" htmlFor="role-name">Nombre del rol</label>
                <input id="role-name" className="input sm:w-80" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej.: Jefe de árbitros" disabled={!canChange} />
              </div>
              {canChange && <button className="btn-primary sm:self-end" onClick={save} disabled={busy || !name.trim()}>{busy ? <Spinner className="h-4 w-4" /> : <Save className="h-4 w-4" />}Guardar</button>}
            </div>
            <div className="max-h-[68vh] overflow-y-auto p-5">
              <PermissionPicker value={checked} onChange={setChecked} disabled={!canChange} />
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
