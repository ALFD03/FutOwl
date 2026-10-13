import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronRight, Plus } from "lucide-react";

import { Can } from "@/components/layout/Guards";
import { TeamCrest } from "@/components/match/TeamCrest";
import { Alert, Badge, Card, CardHeader, Modal, SelectMenu, Spinner } from "@/components/ui";
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
        actions={<Can perm="tournaments.add_tournamentteam"><button className="btn-gold btn-sm" onClick={() => setRegistering(true)}><Plus className="h-4 w-4" /> Inscribir equipo</button></Can>} />
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
 * Inscripción rápida: se elige el equipo y aparecen las categorías del torneo; las que el equipo tiene
 * registradas se pueden marcar varias a la vez. Los grupos se arman después, en la pestaña Grupos.
 */
function RegisterTeamModal({ open, onClose, tournament, registered, onDone }: {
  open: boolean; onClose: () => void; tournament: Tournament; registered: Registration[]; onDone: () => void;
}) {
  const toast = useToast();
  const [teamId, setTeamId] = useState<number | null>(null);
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);
  const allowed = new Set(tournament.categories);
  const teamsQ = useQuery({ queryKey: ["teams", "options"], queryFn: () => teams.all({ is_active: true }), enabled: open, staleTime: 60_000 });
  // Solo equipos que comparten alguna categoría con el torneo.
  const candidates = (teamsQ.data ?? []).filter((t) => t.categories.some((c) => allowed.has(c)));
  const team = candidates.find((t) => t.id === teamId);
  const already = new Set(registered.filter((r) => r.team === teamId).map((r) => r.category));
  const categories = tournament.categories.map((id, i) => ({
    id, name: tournament.category_names[i],
    state: !team?.categories.includes(id) ? "missing" as const : already.has(id) ? "registered" as const : "available" as const,
  }));
  const available = categories.filter((c) => c.state === "available");
  const selected = [...picked];

  const reset = () => { setTeamId(null); setPicked(new Set()); };
  const close = () => { reset(); onClose(); };
  const toggle = (id: number) => setPicked((p) => { const next = new Set(p); if (next.has(id)) next.delete(id); else next.add(id); return next; });

  const submit = async () => {
    setBusy(true);
    const failed: { id: number; message: string }[] = [];
    for (const category of selected) {
      try {
        await registrations.create({ tournament: tournament.id, team: teamId, category });
      } catch (e) {
        failed.push({ id: category, message: `${categories.find((c) => c.id === category)?.name}: ${errorMessage(e)}` });
      }
    }
    setBusy(false);
    onDone();
    const ok = selected.length - failed.length;
    if (ok) toast.success(`${team?.name} inscrito en ${ok} categoría(s).`);
    if (!failed.length) return close();
    // Quedan marcadas solo las que fallaron, para corregir y reintentar.
    toast.error(failed.map((f) => f.message).join(" · "));
    setPicked(new Set(failed.map((f) => f.id)));
  };

  return (
    <Modal open={open} onClose={close} title="Inscribir equipo" subtitle={tournament.name} size="md" footer={<>
      <button className="btn-ghost" onClick={close}>Cancelar</button>
      <button className="btn-gold" onClick={submit} disabled={busy || !selected.length}>
        {busy && <Spinner className="h-4 w-4" />}Inscribir{selected.length > 1 ? ` en ${selected.length} categorías` : ""}
      </button>
    </>}>
      <div className="space-y-5">
        <div>
          <label className="label">Equipo</label>
          <SelectMenu value={teamId} onChange={(v) => { setTeamId(v == null ? null : Number(v)); setPicked(new Set()); }} searchable clearable
            placeholder={teamsQ.isLoading ? "Cargando equipos…" : "Buscar equipo…"}
            options={candidates.map((t) => {
              const done = registered.filter((r) => r.team === t.id).length;
              return { value: t.id, label: t.name, hint: [t.category_names.join(", "), done ? `ya inscrito en ${done}` : ""].filter(Boolean).join(" · ") };
            })} />
          {!teamsQ.isLoading && !candidates.length && <p className="help">Ningún equipo tiene registrada alguna categoría de este torneo.</p>}
        </div>

        {team && (
          <div>
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="label mb-0">Categorías</span>
              {available.length > 1 && (
                <button type="button" className="text-xs font-semibold text-navy-700 hover:underline dark:text-gold-400"
                  onClick={() => setPicked(new Set(selected.length === available.length ? [] : available.map((c) => c.id)))}>
                  {selected.length === available.length ? "Quitar todas" : "Marcar todas"}
                </button>
              )}
            </div>
            <ul className="space-y-2">
              {categories.map((c) => {
                const on = picked.has(c.id);
                return (
                  <li key={c.id} className={`flex flex-wrap items-center gap-3 rounded-xl border px-3 py-2 ${on ? "border-gold-400 bg-gold-50 dark:bg-gold-500/10" : "border-slate-200 dark:border-white/10"}`}>
                    <button type="button" disabled={c.state !== "available"} onClick={() => toggle(c.id)} aria-pressed={on}
                      className="flex flex-1 items-center gap-3 text-left text-sm disabled:cursor-not-allowed">
                      <span className={`grid h-5 w-5 place-items-center rounded-md border ${on ? "border-gold-500 bg-gold-400 text-navy-950" : "border-slate-300 dark:border-white/20"}`}>
                        {on && <Check className="h-3.5 w-3.5" />}
                      </span>
                      <b className={c.state === "available" ? "" : "text-slate-400"}>{c.name}</b>
                      {c.state === "registered" && <Badge tone="emerald">Ya inscrito</Badge>}
                      {c.state === "missing" && <span className="text-xs text-slate-400">El equipo no tiene esta categoría</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
            {!available.length && <div className="mt-3"><Alert tone="info">El equipo ya está inscrito en todas las categorías que puede jugar en este torneo.</Alert></div>}
          </div>
        )}
      </div>
    </Modal>
  );
}
