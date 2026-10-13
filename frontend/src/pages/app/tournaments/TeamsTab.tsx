import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronRight, Minus, Plus, Search } from "lucide-react";

import { Can } from "@/components/layout/Guards";
import { TeamCrest } from "@/components/match/TeamCrest";
import { Alert, Badge, Card, CardHeader, Modal, Spinner } from "@/components/ui";
import { useToast } from "@/hooks";
import { registrations, teams } from "@/services";
import type { Registration, Tournament } from "@/types";
import { errorMessage } from "@/utils/errors";

/** Una fila por equipo; al pulsarla se ven las categorías en las que está inscrito en el torneo. */
export function TeamsTab({ tournament }: { tournament: Tournament }) {
  const queryClient = useQueryClient();
  const [registering, setRegistering] = useState(false);
  const [open, setOpen] = useState<Set<number>>(new Set());
  const regs = useQuery({ queryKey: ["registrations", tournament.id], queryFn: () => registrations.all({ tournament: tournament.id, is_active: true }) });
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["registrations"] });
    void queryClient.invalidateQueries({ queryKey: ["tournaments"] });
  };

  const byTeam = new Map<number, Registration[]>();
  (regs.data ?? []).forEach((r) => byTeam.set(r.team, [...(byTeam.get(r.team) ?? []), r]));
  const teamsList = [...byTeam.values()].sort((a, b) => a[0].team_name.localeCompare(b[0].team_name));
  const toggle = (id: number) => setOpen((o) => { const n = new Set(o); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  return (
    <Card>
      <CardHeader title="Equipos inscritos" subtitle={`${teamsList.length} equipo(s) · ${regs.data?.length ?? 0} inscripción(es) por categoría`}
        actions={<Can perm="tournaments.add_tournamentteam"><button className="btn-gold btn-sm" onClick={() => setRegistering(true)}><Plus className="h-4 w-4" /> Inscribir equipos</button></Can>} />
      {regs.isLoading ? <div className="grid h-24 place-items-center"><Spinner /></div> : !teamsList.length ? (
        <p className="px-5 py-10 text-center text-sm text-slate-400">Todavía no hay equipos inscritos.</p>
      ) : (
        <ul className="divide-y divide-slate-100 dark:divide-white/5">
          {teamsList.map((items) => {
            const team = items[0];
            const expanded = open.has(team.team);
            return (
              <li key={team.team}>
                <button type="button" onClick={() => toggle(team.team)} aria-expanded={expanded}
                  className="flex w-full items-center gap-3 px-5 py-3 text-left transition hover:bg-slate-50 dark:hover:bg-white/[.03]">
                  <ChevronRight className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${expanded ? "rotate-90" : ""}`} />
                  <TeamCrest src={team.team_logo} name={team.team_name} size="sm" />
                  <b className="min-w-0 flex-1 truncate">{team.team_name}</b>
                  <Badge tone="gold">{items.length} categoría(s)</Badge>
                  <span className="hidden text-xs text-slate-500 sm:inline">{items.reduce((n, r) => n + r.roster_count, 0)} jugadores en nómina</span>
                </button>
                {expanded && (
                  <div className="bg-slate-50/60 px-5 pb-4 pt-1 dark:bg-white/[.02]">
                    <table className="w-full text-sm">
                      <thead><tr className="text-left text-xs uppercase tracking-wide text-slate-400">
                        <th className="py-2 pl-7">Categoría</th><th className="py-2">Grupo</th><th className="py-2">Nómina</th>
                      </tr></thead>
                      <tbody>
                        {items.sort((a, b) => a.category_name.localeCompare(b.category_name)).map((r) => (
                          <tr key={r.id} className="border-t border-slate-200/70 dark:border-white/5">
                            <td className="py-2 pl-7"><Badge tone="gold">{r.category_name}</Badge></td>
                            <td className="py-2 text-slate-600 dark:text-slate-300">{r.group_name ?? "—"}</td>
                            <td className="py-2"><Link to={`/app/equipos/${r.team}`} className="font-semibold text-navy-700 hover:underline dark:text-gold-400">{r.roster_count} jugadores</Link></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <RegisterTeamModal open={registering} onClose={() => setRegistering(false)} tournament={tournament}
        registered={regs.data ?? []} onDone={refresh} />
    </Card>
  );
}

/**
 * Inscripción de uno o varios equipos a la vez. Al marcar un equipo quedan marcadas todas las categorías del
 * torneo que tiene disponibles (las que ya tiene inscritas no se tocan); luego se puede quitar cualquiera.
 * Los grupos se arman después, en la pestaña Grupos.
 */
function RegisterTeamModal({ open, onClose, tournament, registered, onDone }: {
  open: boolean; onClose: () => void; tournament: Tournament; registered: Registration[]; onDone: () => void;
}) {
  const toast = useToast();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<number | null>(null);
  const [picked, setPicked] = useState<Map<number, Set<number>>>(new Map());
  const [busy, setBusy] = useState(false);
  const teamsQ = useQuery({ queryKey: ["teams", "options"], queryFn: () => teams.all({ is_active: true }), enabled: open, staleTime: 60_000 });

  const categoryName = new Map(tournament.categories.map((id, i) => [id, tournament.category_names[i]]));
  const done = new Set(registered.map((r) => `${r.team}:${r.category}`));
  // Por equipo: categorías del torneo que tiene registradas, separadas en disponibles y ya inscritas.
  const rows = (teamsQ.data ?? []).map((t) => {
    const own = tournament.categories.filter((c) => t.categories.includes(c));
    return { team: t, available: own.filter((c) => !done.has(`${t.id}:${c}`)), registered: own.filter((c) => done.has(`${t.id}:${c}`)) };
  }).filter((r) => r.available.length || r.registered.length)
    .sort((a, b) => Number(!a.available.length) - Number(!b.available.length) || a.team.name.localeCompare(b.team.name));
  const term = search.trim().toLocaleLowerCase();
  const visible = rows.filter((r) => (!term || r.team.name.toLocaleLowerCase().includes(term))
    && (filter == null || r.available.includes(filter) || r.registered.includes(filter)));
  const selectable = visible.filter((r) => filter == null ? r.available.length : r.available.includes(filter));
  const total = [...picked.values()].reduce((n, set) => n + set.size, 0);

  const update = (fn: (next: Map<number, Set<number>>) => void) => setPicked((p) => {
    const next = new Map([...p].map(([k, v]) => [k, new Set(v)]));
    fn(next);
    [...next].forEach(([k, v]) => { if (!v.size) next.delete(k); });
    return next;
  });
  const toggleTeam = (row: (typeof rows)[number]) => update((next) => {
    if (next.has(row.team.id)) next.delete(row.team.id);
    else next.set(row.team.id, new Set(row.available));
  });
  const toggleCategory = (teamId: number, category: number) => update((next) => {
    const set = next.get(teamId) ?? new Set<number>();
    if (set.has(category)) set.delete(category); else set.add(category);
    next.set(teamId, set);
  });
  // Con un filtro de categoría activo, «marcar todos» inscribe solo en esa categoría.
  const allMarked = selectable.length > 0 && selectable.every((r) => filter == null
    ? r.available.every((c) => picked.get(r.team.id)?.has(c)) : picked.get(r.team.id)?.has(filter));
  const toggleAll = () => update((next) => selectable.forEach((r) => {
    const set = next.get(r.team.id) ?? new Set<number>();
    (filter == null ? r.available : [filter]).forEach((c) => (allMarked ? set.delete(c) : set.add(c)));
    next.set(r.team.id, set);
  }));

  const close = () => { setSearch(""); setFilter(null); setPicked(new Map()); onClose(); };
  const submit = async () => {
    setBusy(true);
    try {
      const result = await registrations.bulk({
        tournament: tournament.id, teams: [...picked].map(([team, set]) => ({ team, categories: [...set] })),
      });
      onDone();
      if (result.created) toast.success(`${result.created} inscripción(es) registrada(s).`);
      if (!result.errors.length) return close();
      // Quedan marcadas solo las que fallaron, para corregir y reintentar.
      toast.error(result.errors.map((e) => `${e.label}: ${e.message}`).join(" · "));
      const failed = new Map<number, Set<number>>();
      result.errors.forEach((e) => failed.set(e.team, (failed.get(e.team) ?? new Set()).add(e.category)));
      setPicked(failed);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={close} title="Inscribir equipos" subtitle={tournament.name} size="lg" footer={<>
      <span className="mr-auto self-center text-sm text-slate-500">
        {picked.size ? `${picked.size} equipo(s) · ${total} inscripción(es)` : "Marque los equipos a inscribir"}
      </span>
      <button className="btn-ghost" onClick={close}>Cancelar</button>
      <button className="btn-gold" onClick={submit} disabled={busy || !total}>
        {busy && <Spinner className="h-4 w-4" />}Inscribir{total ? ` (${total})` : ""}
      </button>
    </>}>
      <div className="space-y-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input className="input pl-9" placeholder="Buscar equipo…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        {tournament.categories.length > 1 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Categoría</span>
            {[null, ...tournament.categories].map((c) => (
              <button key={c ?? "all"} type="button" onClick={() => setFilter(c)} aria-pressed={filter === c}
                className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${filter === c
                  ? "border-navy-700 bg-navy-700 text-white dark:border-gold-400 dark:bg-gold-400 dark:text-navy-950"
                  : "border-slate-200 text-slate-600 hover:border-slate-300 dark:border-white/10 dark:text-slate-300"}`}>
                {c == null ? "Todas" : categoryName.get(c)}
              </button>
            ))}
          </div>
        )}

        {teamsQ.isLoading ? <div className="grid h-24 place-items-center"><Spinner /></div> : !rows.length ? (
          <Alert tone="info">Ningún equipo tiene registrada alguna categoría de este torneo.</Alert>
        ) : (
          <div className="rounded-xl border border-slate-200 dark:border-white/10">
            <div className="flex items-center justify-between gap-2 border-b border-slate-200 px-3 py-2 text-sm dark:border-white/10">
              <button type="button" onClick={toggleAll} disabled={!selectable.length}
                className="flex items-center gap-2 font-semibold text-navy-700 disabled:opacity-40 dark:text-gold-400">
                <Box state={allMarked ? "on" : "off"} />
                {allMarked ? "Quitar" : "Marcar"} {term || filter != null ? "los visibles" : "todos"}
                {filter != null && ` en ${categoryName.get(filter)}`}
              </button>
              {picked.size > 0 && (
                <button type="button" className="text-xs text-slate-500 hover:underline" onClick={() => setPicked(new Map())}>Limpiar selección</button>
              )}
            </div>
            {!visible.length ? <p className="px-3 py-8 text-center text-sm text-slate-400">Ningún equipo coincide con la búsqueda.</p> : (
              <ul className="max-h-[50vh] divide-y divide-slate-100 overflow-y-auto dark:divide-white/5">
                {visible.map((row) => {
                  const set = picked.get(row.team.id);
                  const state = !set ? "off" : row.available.every((c) => set.has(c)) ? "on" : "some";
                  const full = !row.available.length;
                  return (
                    <li key={row.team.id} className={`flex items-start gap-3 px-3 py-2.5 ${set ? "bg-gold-50/70 dark:bg-gold-500/10" : ""}`}>
                      <button type="button" onClick={() => toggleTeam(row)} disabled={full} aria-pressed={!!set}
                        className="flex min-w-0 flex-1 items-center gap-3 text-left disabled:cursor-not-allowed">
                        <Box state={state} disabled={full} />
                        <TeamCrest src={row.team.logo} name={row.team.name} size="sm" />
                        <span className="min-w-0">
                          <b className={`block truncate text-sm ${full ? "text-slate-400" : ""}`}>{row.team.name}</b>
                          {full && <span className="text-xs text-slate-400">Ya inscrito en todas sus categorías</span>}
                        </span>
                      </button>
                      <div className="flex max-w-[55%] flex-wrap justify-end gap-1.5">
                        {row.available.map((c) => {
                          const on = !!set?.has(c);
                          return (
                            <button key={c} type="button" onClick={() => toggleCategory(row.team.id, c)} aria-pressed={on}
                              className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold transition ${on
                                ? "border-gold-500 bg-gold-400 text-navy-950"
                                : "border-slate-300 text-slate-500 hover:border-slate-400 dark:border-white/20 dark:text-slate-400"}`}>
                              {on && <Check className="h-3 w-3" />}{categoryName.get(c)}
                            </button>
                          );
                        })}
                        {row.registered.map((c) => (
                          <Badge key={c} tone="emerald" title="Ya inscrito"><Check className="h-3 w-3" />{categoryName.get(c)}</Badge>
                        ))}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}

/** Casilla visual: marcada, parcial (algunas categorías) o vacía. */
function Box({ state, disabled }: { state: "on" | "some" | "off"; disabled?: boolean }) {
  return (
    <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-md border ${state !== "off"
      ? "border-gold-500 bg-gold-400 text-navy-950" : disabled ? "border-slate-200 bg-slate-100 dark:border-white/10 dark:bg-white/5" : "border-slate-300 dark:border-white/20"}`}>
      {state === "on" && <Check className="h-3.5 w-3.5" />}
      {state === "some" && <Minus className="h-3.5 w-3.5" />}
    </span>
  );
}
