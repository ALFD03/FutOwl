/** Widgets dinámicos de la documentación: roles vigentes, catálogo de permisos y permisos del lector. */
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, KeyRound, Lock, Minus, Search, ShieldCheck, Users } from "lucide-react";

import { APP_LABELS } from "@/components/forms/PermissionPicker";
import { Badge, normalize, SelectMenu, Spinner, Toggle } from "@/components/ui";
import { useAuth } from "@/hooks";
import { docs } from "@/services";
import type { Permission, PermissionCatalog } from "@/types";
import { cn } from "@/utils/cn";

const MODULE_ORDER = ["registry", "tournaments", "competition", "accounts", "auth", "audit", "legal", "notifications"];

function useCatalog() {
  return useQuery({ queryKey: ["docs", "permission-catalog"], queryFn: docs.permissionCatalog, staleTime: 300_000 });
}

function byModule(perms: Permission[]): [string, Permission[]][] {
  const map = new Map<string, Permission[]>();
  perms.forEach((p) => map.set(p.app_label, [...(map.get(p.app_label) ?? []), p]));
  return [...map.entries()].sort((a, b) => MODULE_ORDER.indexOf(a[0]) - MODULE_ORDER.indexOf(b[0]));
}

function rolesByPermission(catalog: PermissionCatalog): Map<string, string[]> {
  const map = new Map<string, string[]>();
  catalog.roles.forEach((role) => role.permissions.forEach((code) => map.set(code, [...(map.get(code) ?? []), role.name])));
  return map;
}

function Loading() {
  return <div className="grid h-24 place-items-center rounded-xl border border-dashed border-slate-200 dark:border-white/10"><Spinner /></div>;
}

// ------------------------------------------------------------------ Roles
export function RolesWidget() {
  const { data, isLoading } = useCatalog();
  const { user } = useAuth();
  if (isLoading || !data) return <Loading />;
  const labels = new Map(data.permissions.map((p) => [p.code, p]));
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {data.roles.map((role) => {
        const mine = user?.groups.includes(role.name);
        const perms = role.permissions.map((c) => labels.get(c)).filter((p): p is Permission => Boolean(p));
        return (
          <details key={role.id} className={cn("group rounded-xl border bg-white p-4 text-sm not-italic dark:bg-ink-800",
            mine ? "border-gold-400 shadow-gold" : "border-slate-200 dark:border-white/10")}>
            <summary className="flex cursor-pointer list-none items-center gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-navy-900 text-gold-400"><KeyRound className="h-4 w-4" /></span>
              <span className="min-w-0 flex-1">
                <b className="block truncate text-slate-900 dark:text-white">{role.name}</b>
                <span className="text-xs text-slate-500">{role.permissions.length} permisos · <Users className="inline h-3 w-3" /> {role.user_count} usuario(s)</span>
              </span>
              {mine && <Badge tone="gold">Tu rol</Badge>}
              <span className="text-xs font-semibold text-navy-700 group-open:hidden dark:text-gold-400">Ver</span>
            </summary>
            <div className="mt-3 space-y-3 border-t border-slate-100 pt-3 dark:border-white/5">
              {byModule(perms).map(([app, items]) => (
                <div key={app}>
                  <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-slate-400">{APP_LABELS[app] ?? app}</p>
                  <div className="flex flex-wrap gap-1">{items.map((p) => <Badge key={p.code} tone="navy" className="font-normal">{p.label}</Badge>)}</div>
                </div>
              ))}
              {!perms.length && <p className="text-xs text-slate-400">Sin permisos asignados.</p>}
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
  const { user, can } = useAuth();
  const [query, setQuery] = useState("");
  const [onlyMine, setOnlyMine] = useState(false);
  const [role, setRole] = useState<string | null>(null);

  const rows = useMemo(() => {
    if (!data) return [];
    const roleMap = rolesByPermission(data);
    const roleCodes = role ? new Set(data.roles.find((r) => r.name === role)?.permissions) : null;
    const q = normalize(query.trim());
    const filtered = data.permissions.filter((p) =>
      (!q || normalize(`${p.label} ${p.code} ${p.model_label} ${APP_LABELS[p.app_label] ?? ""}`).includes(q))
      && (!onlyMine || can(p.code)) && (!roleCodes || roleCodes.has(p.code)));
    return byModule(filtered).map(([app, perms]) => [app, perms.map((p) => ({ ...p, roles: roleMap.get(p.code) ?? [] }))] as const);
  }, [data, query, onlyMine, role, can]);

  if (isLoading || !data) return <Loading />;
  const total = rows.reduce((n, [, perms]) => n + perms.length, 0);

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white not-italic dark:border-white/10 dark:bg-ink-800">
      <div className="flex flex-col gap-3 border-b border-slate-100 p-3 sm:flex-row sm:items-center dark:border-white/5">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input className="input pl-9" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar permiso, código o módulo…" aria-label="Buscar permiso" />
        </div>
        <div className="sm:w-52">
          <SelectMenu value={role} onChange={(v) => setRole(v == null ? null : String(v))} clearable placeholder="Todos los roles"
            options={data.roles.map((r) => ({ value: r.name, label: r.name, hint: `${r.permissions.length} permisos` }))} />
        </div>
        <label className="flex cursor-pointer items-center gap-2 whitespace-nowrap text-sm text-slate-600 dark:text-slate-300">
          <Toggle checked={onlyMine} onChange={setOnlyMine} label="Solo los que tengo" /> Solo los que tengo
        </label>
      </div>
      <p className="border-b border-slate-100 px-3 py-2 text-xs text-slate-500 dark:border-white/5">
        {total} permiso(s){user?.is_superuser && " · Como superusuario tiene todos los permisos."}
      </p>
      <div className="max-h-[640px] overflow-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="sticky top-0 z-10">
            <tr className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-ink-700 dark:text-slate-400">
              <th className="px-3 py-2">Permiso</th><th className="px-3 py-2">Roles que lo incluyen</th><th className="px-3 py-2 text-center">Usted</th>
            </tr>
          </thead>
          {rows.map(([app, perms]) => (
            <tbody key={app}>
              <tr><td colSpan={3} className="bg-navy-50/70 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-navy-800 dark:bg-white/[.04] dark:text-gold-400">{APP_LABELS[app] ?? app}</td></tr>
              {perms.map((p) => (
                <tr key={p.code} className="border-t border-slate-100 dark:border-white/5">
                  <td className="px-3 py-2">
                    <b className="text-slate-800 dark:text-slate-100">{p.label}</b>
                    <span className="block font-mono text-[11px] text-slate-400">{p.code}</span>
                  </td>
                  <td className="px-3 py-2">
                    {p.roles.length ? <span className="flex flex-wrap gap-1">{p.roles.map((r) => <Badge key={r} tone={user?.groups.includes(r) ? "gold" : "slate"}>{r}</Badge>)}</span>
                      : <span className="text-xs text-slate-400">Ningún rol (solo personalizado)</span>}
                  </td>
                  <td className="px-3 py-2 text-center">
                    {can(p.code) ? <Check className="mx-auto h-4 w-4 text-emerald-600" aria-label="Lo tiene" /> : <Minus className="mx-auto h-4 w-4 text-slate-300" aria-label="No lo tiene" />}
                  </td>
                </tr>
              ))}
            </tbody>
          ))}
        </table>
        {!total && <p className="py-8 text-center text-sm text-slate-400">Ningún permiso coincide con el filtro.</p>}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ Mis permisos
export function MyPermissionsWidget() {
  const { data, isLoading } = useCatalog();
  const { user } = useAuth();
  if (isLoading || !data || !user) return <Loading />;
  const mine = data.permissions.filter((p) => user.is_superuser || user.permissions.includes(p.code));
  const fromRoles = new Set(data.roles.filter((r) => user.groups.includes(r.name)).flatMap((r) => r.permissions));
  const custom = mine.filter((p) => !fromRoles.has(p.code));
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
          ? "Tiene todos los permisos de la aplicación y es el único que puede editar esta documentación."
          : `Tiene ${mine.length} permiso(s): ${mine.length - custom.length} por sus roles y ${custom.length} personalizado(s).`}
      </p>
      {!user.is_superuser && (
        <div className="mt-3 space-y-2">
          {byModule(mine).map(([app, perms]) => (
            <div key={app}>
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{APP_LABELS[app] ?? app}</p>
              <div className="mt-1 flex flex-wrap gap-1">
                {perms.map((p) => (
                  <Badge key={p.code} tone={fromRoles.has(p.code) ? "navy" : "gold"} className="font-normal">
                    {fromRoles.has(p.code) && <Lock className="h-2.5 w-2.5" />}{p.label}
                  </Badge>
                ))}
              </div>
            </div>
          ))}
          {custom.length > 0 && <p className="text-xs text-slate-500"><Lock className="inline h-3 w-3" /> = viene de un rol · dorado = personalizado.</p>}
        </div>
      )}
    </div>
  );
}
