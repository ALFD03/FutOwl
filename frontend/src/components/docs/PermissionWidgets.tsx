/** Widgets dinámicos de la documentación: roles vigentes, catálogo de capacidades y capacidades del lector. */
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, KeyRound, Lock, Minus, Search, ShieldCheck, Users } from "lucide-react";

import { Badge, normalize, SelectMenu, Spinner, Toggle } from "@/components/ui";
import { useAuth } from "@/hooks";
import { docs } from "@/services";
import type { Capability, PermissionCatalog } from "@/types";
import { cn } from "@/utils/cn";

function useCatalog() {
  return useQuery({ queryKey: ["docs", "permission-catalog"], queryFn: docs.permissionCatalog, staleTime: 300_000 });
}

function byArea(catalog: PermissionCatalog, items: Capability[]): [string, Capability[]][] {
  return catalog.areas.map((area) => [area, items.filter((c) => c.area === area)] as [string, Capability[]]).filter(([, list]) => list.length);
}

/** ¿El lector tiene la capacidad completa? (todos sus permisos técnicos) */
function useHasCapability() {
  const { user } = useAuth();
  return (c: Capability) => Boolean(user && (user.is_superuser || c.grants.every((g) => user.permissions.includes(g))));
}

function Loading() {
  return <div className="grid h-24 place-items-center rounded-xl border border-dashed border-slate-200 dark:border-white/10"><Spinner /></div>;
}

// ------------------------------------------------------------------ Roles
export function RolesWidget() {
  const { data, isLoading } = useCatalog();
  const { user } = useAuth();
  if (isLoading || !data) return <Loading />;
  const byCode = new Map(data.capabilities.map((c) => [c.code, c]));
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {data.roles.map((role) => {
        const mine = user?.groups.includes(role.name);
        const caps = role.capabilities.map((code) => byCode.get(code)).filter((c): c is Capability => Boolean(c));
        return (
          <details key={role.id} className={cn("group rounded-xl border bg-white p-4 text-sm not-italic dark:bg-ink-800",
            mine ? "border-gold-400 shadow-gold" : "border-slate-200 dark:border-white/10")}>
            <summary className="flex cursor-pointer list-none items-center gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-navy-900 text-gold-400"><KeyRound className="h-4 w-4" /></span>
              <span className="min-w-0 flex-1">
                <b className="block truncate text-slate-900 dark:text-white">{role.name}</b>
                <span className="text-xs text-slate-500">{caps.length} capacidades · <Users className="inline h-3 w-3" /> {role.user_count} usuario(s)</span>
              </span>
              {mine && <Badge tone="gold">Tu rol</Badge>}
              <span className="text-xs font-semibold text-navy-700 group-open:hidden dark:text-gold-400">Ver</span>
            </summary>
            <div className="mt-3 space-y-3 border-t border-slate-100 pt-3 dark:border-white/5">
              {byArea(data, caps).map(([area, items]) => (
                <div key={area}>
                  <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-slate-400">{area}</p>
                  <div className="flex flex-wrap gap-1">{items.map((c) => <Badge key={c.code} tone="navy" className="font-normal" title={c.description}>{c.label}</Badge>)}</div>
                </div>
              ))}
              {!caps.length && <p className="text-xs text-slate-400">Sin capacidades asignadas.</p>}
            </div>
          </details>
        );
      })}
    </div>
  );
}

// ------------------------------------------------------------------ Catálogo
export function PermissionCatalogWidget() {
  const { data, isLoading } = useCatalog();
  const { user } = useAuth();
  const hasCapability = useHasCapability();
  const [query, setQuery] = useState("");
  const [onlyMine, setOnlyMine] = useState(false);
  const [role, setRole] = useState<string | null>(null);

  const rows = useMemo(() => {
    if (!data) return [];
    const roleCaps = role ? new Set(data.roles.find((r) => r.name === role)?.capabilities) : null;
    const q = normalize(query.trim());
    const filtered = data.capabilities.filter((c) =>
      (!q || normalize(`${c.label} ${c.description} ${c.area}`).includes(q))
      && (!onlyMine || hasCapability(c)) && (!roleCaps || roleCaps.has(c.code)));
    return byArea(data, filtered).map(([area, caps]) => [area, caps.map((c) => ({
      ...c, roles: data.roles.filter((r) => r.capabilities.includes(c.code)).map((r) => r.name),
    }))] as const);
  }, [data, query, onlyMine, role, hasCapability]);

  if (isLoading || !data) return <Loading />;
  const total = rows.reduce((n, [, caps]) => n + caps.length, 0);

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white not-italic dark:border-white/10 dark:bg-ink-800">
      <div className="flex flex-col gap-3 border-b border-slate-100 p-3 sm:flex-row sm:items-center dark:border-white/5">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input className="input pl-9" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar capacidad…" aria-label="Buscar capacidad" />
        </div>
        <div className="sm:w-52">
          <SelectMenu value={role} onChange={(v) => setRole(v == null ? null : String(v))} clearable placeholder="Todos los roles"
            options={data.roles.map((r) => ({ value: r.name, label: r.name, hint: `${r.capabilities.length} capacidades` }))} />
        </div>
        <label className="flex cursor-pointer items-center gap-2 whitespace-nowrap text-sm text-slate-600 dark:text-slate-300">
          <Toggle checked={onlyMine} onChange={setOnlyMine} label="Solo las que tengo" /> Solo las que tengo
        </label>
      </div>
      <p className="border-b border-slate-100 px-3 py-2 text-xs text-slate-500 dark:border-white/5">
        {total} capacidad(es){user?.is_superuser && " · Como superusuario tiene todas."}
      </p>
      <div className="max-h-[640px] overflow-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="sticky top-0 z-10">
            <tr className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-ink-700 dark:text-slate-400">
              <th className="px-3 py-2">Capacidad</th><th className="px-3 py-2">Roles que la incluyen</th><th className="px-3 py-2 text-center">Usted</th>
            </tr>
          </thead>
          {rows.map(([area, caps]) => (
            <tbody key={area}>
              <tr><td colSpan={3} className="bg-navy-50/70 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-navy-800 dark:bg-white/[.04] dark:text-gold-400">{area}</td></tr>
              {caps.map((c) => (
                <tr key={c.code} className="border-t border-slate-100 align-top dark:border-white/5">
                  <td className="px-3 py-2">
                    <b className="text-slate-800 dark:text-slate-100">{c.label}</b>
                    <span className="block text-xs text-slate-500 dark:text-slate-400">{c.description}</span>
                  </td>
                  <td className="px-3 py-2">
                    {c.roles.length ? <span className="flex flex-wrap gap-1">{c.roles.map((r) => <Badge key={r} tone={user?.groups.includes(r) ? "gold" : "slate"}>{r}</Badge>)}</span>
                      : <span className="text-xs text-slate-400">Ningún rol (solo extra por usuario)</span>}
                  </td>
                  <td className="px-3 py-2 text-center">
                    {hasCapability(c) ? <Check className="mx-auto h-4 w-4 text-emerald-600" aria-label="La tiene" /> : <Minus className="mx-auto h-4 w-4 text-slate-300" aria-label="No la tiene" />}
                  </td>
                </tr>
              ))}
            </tbody>
          ))}
        </table>
        {!total && <p className="py-8 text-center text-sm text-slate-400">Ninguna capacidad coincide con el filtro.</p>}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ Mis capacidades
export function MyPermissionsWidget() {
  const { data, isLoading } = useCatalog();
  const { user } = useAuth();
  const hasCapability = useHasCapability();
  if (isLoading || !data || !user) return <Loading />;
  const mine = data.capabilities.filter(hasCapability);
  const fromRoles = new Set(data.roles.filter((r) => user.groups.includes(r.name)).flatMap((r) => r.capabilities));
  const extra = mine.filter((c) => !fromRoles.has(c.code));
  return (
    <div className="rounded-xl border border-gold-300 bg-gold-50/50 p-4 text-sm not-italic dark:border-gold-500/30 dark:bg-gold-500/5">
      <div className="flex flex-wrap items-center gap-2">
        <ShieldCheck className="h-5 w-5 text-gold-600" />
        <b className="text-slate-900 dark:text-white">Su acceso actual</b>
        {user.is_superuser && <Badge tone="gold">Superusuario</Badge>}
        {user.groups.map((g) => <Badge key={g} tone="navy">{g}</Badge>)}
        {!user.groups.length && !user.is_superuser && <Badge>Sin rol</Badge>}
      </div>
      <p className="mt-2 text-slate-600 dark:text-slate-300">
        {user.is_superuser
          ? "Tiene todas las capacidades y es el único que puede editar esta documentación."
          : `Tiene ${mine.length} capacidad(es): ${mine.length - extra.length} por sus roles y ${extra.length} extra.`}
      </p>
      {!user.is_superuser && (
        <div className="mt-3 space-y-2">
          {byArea(data, mine).map(([area, caps]) => (
            <div key={area}>
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{area}</p>
              <div className="mt-1 flex flex-wrap gap-1">
                {caps.map((c) => (
                  <Badge key={c.code} tone={fromRoles.has(c.code) ? "navy" : "gold"} className="font-normal" title={c.description}>
                    {fromRoles.has(c.code) && <Lock className="h-2.5 w-2.5" />}{c.label}
                  </Badge>
                ))}
              </div>
            </div>
          ))}
          {extra.length > 0 && <p className="text-xs text-slate-500"><Lock className="inline h-3 w-3" /> = viene de un rol · dorado = extra del usuario.</p>}
        </div>
      )}
    </div>
  );
}
