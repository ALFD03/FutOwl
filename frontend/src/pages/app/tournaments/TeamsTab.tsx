import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Plus } from "lucide-react";

import { ResourceForm } from "@/components/forms";
import { Can } from "@/components/layout/Guards";
import { TeamCrest } from "@/components/match/TeamCrest";
import { Alert, Badge, Card, CardHeader, DataTable, Modal, SelectMenu, Spinner } from "@/components/ui";
import { useToast } from "@/hooks";
import { groups, registrations, teams } from "@/services";
import type { Group, Registration, Tournament } from "@/types";
import { errorMessage } from "@/utils/errors";

export function TeamsTab({ tournament }: { tournament: Tournament }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [modal, setModal] = useState<"team" | "group" | null>(null);
  const regs = useQuery({ queryKey: ["registrations", tournament.id], queryFn: () => registrations.all({ tournament: tournament.id, is_active: true }) });
  const grps = useQuery({ queryKey: ["groups", tournament.id], queryFn: () => groups.all({ tournament: tournament.id, is_active: true }) });
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["registrations"] });
    void queryClient.invalidateQueries({ queryKey: ["groups"] });
    void queryClient.invalidateQueries({ queryKey: ["tournaments"] });
  };

  const changeGroup = async (reg: Registration, group: string) => {
    try {
      await registrations.update(reg.id, { group: group ? Number(group) : null });
      toast.success("Grupo asignado.");
      refresh();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
      <Card>
        <CardHeader title="Equipos inscritos" subtitle={`${regs.data?.length ?? 0} inscripciones`}
          actions={<Can perm="tournaments.add_tournamentteam"><button className="btn-gold btn-sm" onClick={() => setModal("team")}><Plus className="h-4 w-4" /> Inscribir equipo</button></Can>} />
        <DataTable<Registration> loading={regs.isLoading} rows={regs.data ?? []} columns={[
          { key: "team", header: "Equipo", render: (r) => <span className="flex items-center gap-2"><TeamCrest src={r.team_logo} name={r.team_name} size="sm" /><b>{r.team_name}</b></span> },
          { key: "cat", header: "Categoría", render: (r) => <Badge tone="gold">{r.category_name}</Badge> },
          { key: "roster", header: "Nómina", render: (r) => <Link to={`/app/equipos/${r.team}`} className="text-sm font-semibold text-navy-700 hover:underline dark:text-gold-400">{r.roster_count} jugadores</Link> },
          { key: "group", header: "Grupo", render: (r) => (
            <div className="w-40"><SelectMenu value={r.group ?? null} clearable placeholder="Sin grupo" className="py-1" onChange={(v) => changeGroup(r, v == null ? "" : String(v))}
              options={(grps.data ?? []).filter((g) => g.category === r.category).map((g) => ({ value: g.id, label: g.name }))} /></div>
          ) },
        ]} />
      </Card>
      <Card className="h-fit">
        <CardHeader title="Grupos" actions={<Can perm="tournaments.add_group"><button className="btn-outline btn-sm" onClick={() => setModal("group")}><Plus className="h-4 w-4" /> Grupo</button></Can>} />
        <ul className="divide-y divide-slate-100 dark:divide-white/5">
          {(grps.data ?? []).map((g: Group) => (
            <li key={g.id} className="flex items-center justify-between px-5 py-3 text-sm">
              <span><b>{g.name}</b><span className="block text-xs text-slate-500">{g.category_name}</span></span>
              <Badge tone="navy">{g.team_ids.length} equipos</Badge>
            </li>
          ))}
          {grps.data?.length === 0 && <li className="px-5 py-6 text-center text-sm text-slate-400">Sin grupos (liga única)</li>}
        </ul>
      </Card>

      <RegisterTeamModal open={modal === "team"} onClose={() => setModal(null)} tournament={tournament}
        registered={regs.data ?? []} groups={grps.data ?? []} onDone={refresh} />
      <Modal open={modal === "group"} onClose={() => setModal(null)} title="Nuevo grupo" size="sm">
        <ResourceForm fields={[
          { name: "name", label: "Nombre", type: "text", required: true, placeholder: "Grupo A" },
          { name: "category", label: "Categoría", type: "select", required: true, options: tournament.categories.map((id, i) => ({ value: id, label: tournament.category_names[i] })) },
        ]} onCancel={() => setModal(null)} onSubmit={async (v) => {
          await groups.create({ ...v, tournament: tournament.id });
          toast.success("Grupo creado.");
          setModal(null);
          refresh();
        }} />
      </Modal>
    </div>
  );
}

/**
 * Inscripción rápida: se elige el equipo y aparecen las categorías del torneo; las que el equipo tiene
 * registradas se pueden marcar varias a la vez (con su grupo, si la categoría ya tiene grupos).
 */
function RegisterTeamModal({ open, onClose, tournament, registered, groups: allGroups, onDone }: {
  open: boolean; onClose: () => void; tournament: Tournament; registered: Registration[]; groups: Group[]; onDone: () => void;
}) {
  const toast = useToast();
  const [teamId, setTeamId] = useState<number | null>(null);
  const [picked, setPicked] = useState<Record<number, number | null>>({}); // categoría → grupo (null = sin grupo)
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
  const selected = Object.keys(picked).map(Number);

  const reset = () => { setTeamId(null); setPicked({}); };
  const close = () => { reset(); onClose(); };
  const toggle = (id: number) => setPicked((p) => {
    const next = { ...p };
    if (id in next) delete next[id]; else next[id] = null;
    return next;
  });

  const submit = async () => {
    setBusy(true);
    const failed: { id: number; message: string }[] = [];
    for (const category of selected) {
      try {
        await registrations.create({ tournament: tournament.id, team: teamId, category, group: picked[category] });
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
    setPicked(Object.fromEntries(failed.map((f) => [f.id, picked[f.id]])));
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
          <SelectMenu value={teamId} onChange={(v) => { setTeamId(v == null ? null : Number(v)); setPicked({}); }} searchable clearable
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
                  onClick={() => setPicked(selected.length === available.length ? {} : Object.fromEntries(available.map((c) => [c.id, picked[c.id] ?? null])))}>
                  {selected.length === available.length ? "Quitar todas" : "Marcar todas"}
                </button>
              )}
            </div>
            <ul className="space-y-2">
              {categories.map((c) => {
                const on = c.id in picked;
                const catGroups = allGroups.filter((g) => g.category === c.id);
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
                    {on && catGroups.length > 0 && (
                      <div className="w-40">
                        <SelectMenu value={picked[c.id]} clearable placeholder="Sin grupo" className="py-1 text-xs"
                          onChange={(v) => setPicked((p) => ({ ...p, [c.id]: v == null ? null : Number(v) }))}
                          options={catGroups.map((g) => ({ value: g.id, label: g.name }))} />
                      </div>
                    )}
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
