/** Selector de permisos agrupado por módulo y modelo, con interruptores y nombres en español. */
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Eye, Lock, Search } from "lucide-react";

import { Badge, normalize, Spinner, Switch } from "@/components/ui";
import { permissions as permissionsService } from "@/services";
import type { Permission } from "@/types";
import { cn } from "@/utils/cn";

export const APP_LABELS: Record<string, string> = {
  accounts: "Usuarios", auth: "Roles", audit: "Auditoría", legal: "Términos y condiciones", notifications: "Notificaciones",
  registry: "Registro", tournaments: "Torneos", competition: "Competición",
};

const isView = (p: Permission) => p.codename.startsWith("view_");

export function usePermissionsCatalog() {
  return useQuery({ queryKey: ["permissions"], queryFn: permissionsService.all, staleTime: 300_000 });
}

/**
 * `value`: permisos elegidos. `locked`: permisos que ya vienen de los roles del usuario; se ven
 * encendidos y bloqueados para distinguir lo heredado de lo personalizado.
 */
export function PermissionPicker({ value, onChange, locked, disabled }: {
  value: number[]; onChange: (ids: number[]) => void; locked?: Set<number>; disabled?: boolean;
}) {
  const { data = [], isLoading } = usePermissionsCatalog();
  const [filter, setFilter] = useState("");
  const selected = useMemo(() => new Set(value), [value]);
  const inherited = locked ?? new Set<number>();

  const modules = useMemo(() => {
    const q = normalize(filter.trim());
    const map = new Map<string, Map<string, Permission[]>>();
    data
      .filter((p) => !q || normalize(`${p.label} ${p.code} ${p.model_label} ${APP_LABELS[p.app_label] ?? ""}`).includes(q))
      .forEach((p) => {
        const models = map.get(p.app_label) ?? new Map<string, Permission[]>();
        models.set(p.model_label, [...(models.get(p.model_label) ?? []), p]);
        map.set(p.app_label, models);
      });
    return [...map.entries()];
  }, [data, filter]);

  const set = (ids: number[], on: boolean) => {
    const next = new Set(selected);
    ids.filter((id) => !inherited.has(id)).forEach((id) => (on ? next.add(id) : next.delete(id)));
    onChange([...next]);
  };
  const visible = modules.flatMap(([, models]) => [...models.values()].flat());
  const effective = (p: Permission) => selected.has(p.id) || inherited.has(p.id);

  if (isLoading) return <div className="grid h-32 place-items-center"><Spinner /></div>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input className="input pl-9" placeholder="Filtrar por módulo o permiso…" value={filter} onChange={(e) => setFilter(e.target.value)} />
        </div>
        <Badge tone="gold">{data.filter(effective).length} de {data.length} permisos</Badge>
        {inherited.size > 0 && <Badge tone="navy"><Lock className="h-3 w-3" /> {inherited.size} por rol</Badge>}
        {!disabled && (
          <span className="flex gap-1">
            <button type="button" className="btn-ghost btn-sm" onClick={() => set(visible.map((p) => p.id), true)}>Marcar visibles</button>
            <button type="button" className="btn-ghost btn-sm" onClick={() => set(visible.map((p) => p.id), false)}>Quitar visibles</button>
            <button type="button" className="btn-ghost btn-sm" title="Solo permisos de consulta" onClick={() => onChange(data.filter((p) => isView(p) && !inherited.has(p.id)).map((p) => p.id))}>
              <Eye className="h-3.5 w-3.5" /> Solo consulta
            </button>
          </span>
        )}
      </div>

      {modules.map(([app, models]) => {
        const perms = [...models.values()].flat();
        const count = perms.filter(effective).length;
        const all = count === perms.length;
        return (
          <section key={app} className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4 dark:border-white/10 dark:bg-white/[.02]">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h3 className="flex items-center gap-2 text-sm font-bold text-navy-900 dark:text-gold-400">
                {APP_LABELS[app] ?? app}
                <span className={cn("rounded-full px-2 py-0.5 text-[11px] tabular-nums", count ? "bg-navy-900 text-white dark:bg-gold-500/20 dark:text-gold-300" : "bg-slate-200 text-slate-500 dark:bg-white/5")}>{count}/{perms.length}</span>
              </h3>
              {!disabled && (
                <span className="flex gap-1">
                  <button type="button" className="rounded-lg px-2 py-1 text-xs font-semibold text-navy-700 hover:bg-white dark:text-gold-400 dark:hover:bg-white/5" onClick={() => set(perms.map((p) => p.id), !all)}>
                    {all ? "Quitar módulo" : "Todo el módulo"}
                  </button>
                  <button type="button" className="rounded-lg px-2 py-1 text-xs text-slate-500 hover:bg-white dark:hover:bg-white/5" onClick={() => set(perms.filter(isView).map((p) => p.id), true)}>Solo ver</button>
                </span>
              )}
            </div>
            <div className="space-y-3">
              {[...models.entries()].map(([model, items]) => (
                <div key={model}>
                  <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">{model}</p>
                  <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                    {items.map((p) => {
                      const fromRole = inherited.has(p.id);
                      return (
                        <Switch key={p.id} checked={effective(p)} disabled={disabled} locked={fromRole} onChange={(on) => set([p.id], on)}
                          label={p.label} description={<span className="font-mono text-[10px]">{p.code}</span>}
                          badge={fromRole ? <Badge tone="navy" className="px-1.5 py-0 text-[10px]"><Lock className="h-2.5 w-2.5" /> Por rol</Badge> : undefined}
                          className="py-2" />
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </section>
        );
      })}
      {!modules.length && <p className="py-6 text-center text-sm text-slate-400">Ningún permiso coincide con el filtro.</p>}
    </div>
  );
}
