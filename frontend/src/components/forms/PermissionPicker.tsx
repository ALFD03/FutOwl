/**
 * Selector de capacidades agrupadas por área. Cada capacidad es una función real (p. ej. «Asignar árbitros»)
 * y agrupa los permisos técnicos que necesita: `value` sigue siendo la lista de ids de esos permisos,
 * que es lo que guardan roles y usuarios.
 */
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Eye, Lock, Search } from "lucide-react";

import { Badge, normalize, Spinner, Switch } from "@/components/ui";
import { permissions as permissionsService } from "@/services";
import type { Capability } from "@/types";
import { cn } from "@/utils/cn";

export function useCapabilities() {
  return useQuery({ queryKey: ["capabilities"], queryFn: permissionsService.capabilities, staleTime: 300_000 });
}

/**
 * `value`: permisos elegidos. `locked`: permisos que ya vienen de los roles del usuario; sus capacidades se
 * ven encendidas y bloqueadas para distinguir lo heredado de lo personalizado.
 */
export function PermissionPicker({ value, onChange, locked, disabled }: {
  value: number[]; onChange: (ids: number[]) => void; locked?: Set<number>; disabled?: boolean;
}) {
  const { data, isLoading } = useCapabilities();
  const [filter, setFilter] = useState("");
  const selected = useMemo(() => new Set(value), [value]);
  const inherited = locked ?? new Set<number>();
  const capabilities = data?.capabilities ?? [];

  const has = (id: number) => selected.has(id) || inherited.has(id);
  const isOn = (c: Capability) => c.permissions.every(has);
  const isPartial = (c: Capability) => !isOn(c) && c.permissions.some(has);
  const isLocked = (c: Capability) => c.permissions.every((id) => inherited.has(id));

  // Permisos guardados que no forman parte de ninguna capacidad (asignaciones antiguas): no habilitan nada útil.
  const known = useMemo(() => new Set(capabilities.flatMap((c) => c.permissions)), [capabilities]);
  const legacy = value.filter((id) => !known.has(id));

  const toggle = (targets: Capability[], on: boolean) => {
    const next = new Set(selected);
    if (on) {
      targets.forEach((c) => c.permissions.forEach((id) => !inherited.has(id) && next.add(id)));
    } else {
      // Un permiso compartido se conserva si otra capacidad encendida (que no se apaga) lo necesita.
      const keep = new Set(capabilities.filter((c) => !targets.includes(c) && isOn(c)).flatMap((c) => c.permissions));
      targets.forEach((c) => c.permissions.forEach((id) => !keep.has(id) && next.delete(id)));
    }
    onChange([...next]);
  };

  const areas = useMemo(() => {
    const q = normalize(filter.trim());
    return (data?.areas ?? []).map((area) => [area, capabilities.filter((c) => c.area === area
      && (!q || normalize(`${c.label} ${c.description} ${area}`).includes(q)))] as const).filter(([, items]) => items.length);
  }, [data, capabilities, filter]);

  if (isLoading || !data) return <div className="grid h-32 place-items-center"><Spinner /></div>;
  const visible = areas.flatMap(([, items]) => items);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input className="input pl-9" placeholder="Buscar capacidad…" value={filter} onChange={(e) => setFilter(e.target.value)} />
        </div>
        <Badge tone="gold">{capabilities.filter(isOn).length} de {capabilities.length} capacidades</Badge>
        {inherited.size > 0 && <Badge tone="navy"><Lock className="h-3 w-3" /> {capabilities.filter(isLocked).length} por rol</Badge>}
        {!disabled && (
          <span className="flex gap-1">
            <button type="button" className="btn-ghost btn-sm" onClick={() => toggle(visible, true)}>Marcar visibles</button>
            <button type="button" className="btn-ghost btn-sm" onClick={() => toggle(visible, false)}>Quitar visibles</button>
            <button type="button" className="btn-ghost btn-sm" title="Solo las capacidades de consulta"
              onClick={() => onChange(capabilities.filter((c) => c.area === "Consulta").flatMap((c) => c.permissions).filter((id) => !inherited.has(id)))}>
              <Eye className="h-3.5 w-3.5" /> Solo consulta
            </button>
          </span>
        )}
      </div>

      {legacy.length > 0 && !disabled && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
          <span>Tiene {legacy.length} permiso(s) técnico(s) antiguos que no forman parte de ninguna capacidad y no habilitan nada.</span>
          <button type="button" className="font-semibold underline" onClick={() => onChange(value.filter((id) => known.has(id)))}>Quitarlos</button>
        </div>
      )}

      {areas.map(([area, items]) => {
        const count = items.filter(isOn).length;
        const all = count === items.length;
        return (
          <section key={area} className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4 dark:border-white/10 dark:bg-white/[.02]">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h3 className="flex items-center gap-2 text-sm font-bold text-navy-900 dark:text-gold-400">
                {area}
                <span className={cn("rounded-full px-2 py-0.5 text-[11px] tabular-nums", count ? "bg-navy-900 text-white dark:bg-gold-500/20 dark:text-gold-300" : "bg-slate-200 text-slate-500 dark:bg-white/5")}>{count}/{items.length}</span>
              </h3>
              {!disabled && (
                <button type="button" className="rounded-lg px-2 py-1 text-xs font-semibold text-navy-700 hover:bg-white dark:text-gold-400 dark:hover:bg-white/5" onClick={() => toggle(items, !all)}>
                  {all ? "Quitar todas" : "Todas"}
                </button>
              )}
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              {items.map((c) => {
                const fromRole = isLocked(c);
                return (
                  <Switch key={c.code} checked={isOn(c)} disabled={disabled} locked={fromRole} onChange={(on) => toggle([c], on)}
                    label={c.label} description={c.description}
                    badge={fromRole ? <Badge tone="navy" className="px-1.5 py-0 text-[10px]"><Lock className="h-2.5 w-2.5" /> Por rol</Badge>
                      : isPartial(c) ? <Badge tone="amber" className="px-1.5 py-0 text-[10px]">Parcial</Badge> : undefined}
                    className="py-2" />
                );
              })}
            </div>
          </section>
        );
      })}
      {!areas.length && <p className="py-6 text-center text-sm text-slate-400">Ninguna capacidad coincide con la búsqueda.</p>}
    </div>
  );
}
