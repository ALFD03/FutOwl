import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { KeyRound, Plus, Save } from "lucide-react";

import { Can } from "@/components/layout/Guards";
import { Badge, Card, CardHeader, EmptyState, PageHeader, SearchInput, Spinner } from "@/components/ui";
import { useCan, useToast } from "@/hooks";
import { permissions as permissionsService, roles } from "@/services";
import type { Permission, Role } from "@/types";
import { cn } from "@/utils/cn";
import { errorMessage } from "@/utils/errors";

const APP_LABELS: Record<string, string> = {
  accounts: "Cuentas", auth: "Roles", audit: "Auditoría", legal: "Términos", notifications: "Notificaciones",
  registry: "Registro", tournaments: "Torneos", competition: "Competición",
};

export function RolesPage() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const canChange = useCan("auth.change_group");
  const rolesQ = useQuery({ queryKey: ["roles", "all"], queryFn: () => roles.all() });
  const permsQ = useQuery({ queryKey: ["permissions"], queryFn: permissionsService.all, staleTime: 300_000 });
  const [selected, setSelected] = useState<Role | null>(null);
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [name, setName] = useState("");
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setChecked(new Set(selected?.permissions ?? []));
    setName(selected?.name ?? "");
  }, [selected]);

  const grouped = useMemo(() => {
    const map = new Map<string, Permission[]>();
    (permsQ.data ?? []).filter((p) => !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.code.includes(search))
      .forEach((p) => map.set(p.app_label, [...(map.get(p.app_label) ?? []), p]));
    return [...map.entries()];
  }, [permsQ.data, search]);

  const toggle = (id: number) => setChecked((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const toggleGroup = (items: Permission[], on: boolean) => setChecked((s) => { const n = new Set(s); items.forEach((p) => (on ? n.add(p.id) : n.delete(p.id))); return n; });

  const save = async () => {
    setBusy(true);
    try {
      const payload = { name, permissions: [...checked] };
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
              <input className="input sm:w-64" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre del rol" disabled={!canChange} />
              <SearchInput value={search} onChange={setSearch} placeholder="Filtrar permisos…" />
              <Badge tone="gold">{checked.size} permisos</Badge>
              {canChange && <button className="btn-primary sm:ml-auto" onClick={save} disabled={busy || !name.trim()}>{busy ? <Spinner className="h-4 w-4" /> : <Save className="h-4 w-4" />}Guardar</button>}
            </div>
            <div className="max-h-[65vh] space-y-6 overflow-y-auto p-5">
              {grouped.map(([app, items]) => {
                const all = items.every((p) => checked.has(p.id));
                return (
                  <section key={app}>
                    <div className="mb-2 flex items-center justify-between">
                      <h3 className="text-sm font-bold text-navy-900 dark:text-gold-400">{APP_LABELS[app] ?? app}</h3>
                      {canChange && <button className="text-xs font-semibold text-navy-700 hover:underline dark:text-gold-400" onClick={() => toggleGroup(items, !all)}>{all ? "Quitar todos" : "Marcar todos"}</button>}
                    </div>
                    <div className="grid gap-1.5 sm:grid-cols-2 xl:grid-cols-3">
                      {items.map((p) => (
                        <label key={p.id} className={cn("flex cursor-pointer items-start gap-2 rounded-lg border px-3 py-2 text-xs transition",
                          checked.has(p.id) ? "border-navy-300 bg-navy-50 dark:border-gold-500/40 dark:bg-gold-500/10" : "border-slate-100 dark:border-white/5")}>
                          <input type="checkbox" className="mt-0.5 accent-navy-900" checked={checked.has(p.id)} onChange={() => toggle(p.id)} disabled={!canChange} />
                          <span>{p.name}<span className="block font-mono text-[10px] text-slate-400">{p.code}</span></span>
                        </label>
                      ))}
                    </div>
                  </section>
                );
              })}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
