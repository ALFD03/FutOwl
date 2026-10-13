import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarPlus, Plus, Shuffle } from "lucide-react";

import { ResourceForm } from "@/components/forms";
import { Can } from "@/components/layout/Guards";
import { TeamCrest } from "@/components/match/TeamCrest";
import { Alert, Badge, Card, CardHeader, EmptyState, Modal, SelectMenu, Spinner } from "@/components/ui";
import { useCan, useToast } from "@/hooks";
import { groups, knockout, registrations } from "@/services";
import type { Registration, Tournament } from "@/types";
import { errorMessage } from "@/utils/errors";

/** Modalidades que usan fase de grupos. */
export const usesGroups = (t: Tournament) => t.modality === "groups" || t.modality === "groups_knockout";

export function GroupsTab({ tournament }: { tournament: Tournament }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const canAssign = useCan("tournaments.change_tournamentteam");
  const [category, setCategory] = useState<number>(tournament.categories[0]);
  const [creating, setCreating] = useState(false);
  const [drawing, setDrawing] = useState(false);
  const [busy, setBusy] = useState(false);
  const regs = useQuery({ queryKey: ["registrations", tournament.id], queryFn: () => registrations.all({ tournament: tournament.id, is_active: true }) });
  const grps = useQuery({ queryKey: ["groups", tournament.id], queryFn: () => groups.all({ tournament: tournament.id, is_active: true }) });
  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["registrations"] });
    await queryClient.invalidateQueries({ queryKey: ["groups"] });
    await queryClient.invalidateQueries({ queryKey: ["matches"] });
    await queryClient.invalidateQueries({ queryKey: ["knockout"] });
  };

  const generateFixtures = async () => {
    setBusy(true);
    try {
      const res = await knockout.groupFixtures(tournament.id, category);
      toast.success(`${res.created} partidos de grupos creados en borrador (pestaña Partidos).`);
      await refresh();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const catRegs = (regs.data ?? []).filter((r) => r.category === category);
  const catGroups = (grps.data ?? []).filter((g) => g.category === category);
  const unassigned = catRegs.filter((r) => !r.group);

  const assign = async (reg: Registration, group: number | null) => {
    try {
      await registrations.update(reg.id, { group });
      await refresh();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  const teamRow = (r: Registration) => (
    <li key={r.id} className="flex items-center gap-2 py-1.5 text-sm">
      <TeamCrest src={r.team_logo} name={r.team_name} size="sm" />
      <span className="min-w-0 flex-1 truncate">{r.team_name}</span>
      {canAssign && (
        <div className="w-32">
          <SelectMenu value={r.group} clearable placeholder="Sin grupo" className="py-1 text-xs" onChange={(v) => assign(r, v == null ? null : Number(v))}
            options={catGroups.map((g) => ({ value: g.id, label: g.name }))} />
        </div>
      )}
    </li>
  );

  if (regs.isLoading || grps.isLoading) return <div className="grid h-32 place-items-center"><Spinner /></div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="w-56"><SelectMenu value={category} onChange={(v) => setCategory(Number(v))}
          options={tournament.categories.map((id, i) => ({ value: id, label: tournament.category_names[i], hint: `${(regs.data ?? []).filter((r) => r.category === id).length} equipos` }))} /></div>
        <span className="text-sm text-slate-500">{catRegs.length} equipos · {catGroups.length} grupos</span>
        <div className="ml-auto flex flex-wrap gap-2">
          <Can perm="tournaments.add_group"><button className="btn-outline btn-sm" onClick={() => setCreating(true)}><Plus className="h-4 w-4" /> Grupo</button></Can>
          <Can perm="tournaments.add_group"><button className="btn-gold btn-sm" disabled={catRegs.length < 2} onClick={() => setDrawing(true)}><Shuffle className="h-4 w-4" /> Sortear grupos</button></Can>
          {catGroups.length > 0 && <Can perm="competition.generate_fixture"><button className="btn-outline btn-sm" disabled={busy} onClick={generateFixtures}>{busy ? <Spinner className="h-4 w-4" /> : <CalendarPlus className="h-4 w-4" />} Generar fixture de grupos</button></Can>}
        </div>
      </div>

      {!catGroups.length ? (
        <Card><EmptyState title="Sin grupos" message="Cree los grupos de esta categoría y asigne los equipos." /></Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {catGroups.map((g) => {
            const members = catRegs.filter((r) => r.group === g.id);
            return (
              <Card key={g.id}>
                <CardHeader title={g.name} actions={<Badge tone="navy">{members.length} equipos</Badge>} />
                <ul className="px-5 pb-4">{members.map(teamRow)}{!members.length && <li className="py-3 text-sm text-slate-400">Sin equipos</li>}</ul>
              </Card>
            );
          })}
        </div>
      )}

      {unassigned.length > 0 && (
        <Card>
          <CardHeader title="Equipos sin grupo" subtitle="Asígnelos a un grupo" />
          <ul className="grid gap-x-6 px-5 pb-4 md:grid-cols-2">{unassigned.map(teamRow)}</ul>
        </Card>
      )}

      <DrawModal open={drawing} onClose={() => setDrawing(false)} teams={catRegs.length} hasGroups={catGroups.length > 0}
        onDraw={async (count) => {
          await knockout.drawGroups(tournament.id, category, count);
          toast.success(`Sorteo hecho: ${catRegs.length} equipos en ${count} grupos.`);
          setDrawing(false);
          await refresh();
        }} />
      <Modal open={creating} onClose={() => setCreating(false)} title="Nuevo grupo" size="sm" subtitle={tournament.category_names[tournament.categories.indexOf(category)]}>
        <ResourceForm fields={[{ name: "name", label: "Nombre", type: "text", required: true, placeholder: `Grupo ${String.fromCharCode(65 + catGroups.length)}` }]}
          onCancel={() => setCreating(false)} onSubmit={async (v) => {
            await groups.create({ ...v, tournament: tournament.id, category });
            toast.success("Grupo creado.");
            setCreating(false);
            await refresh();
          }} />
      </Modal>
    </div>
  );
}

/** Sorteo: cantidad de grupos (sugerida ≈ 4 equipos por grupo) con vista previa de los tamaños resultantes. */
function DrawModal({ open, onClose, teams, hasGroups, onDraw }: {
  open: boolean; onClose: () => void; teams: number; hasGroups: boolean; onDraw: (count: number) => Promise<void>;
}) {
  const toast = useToast();
  const max = Math.max(1, Math.floor(teams / 2));
  const [count, setCount] = useState(Math.min(max, Math.max(1, Math.round(teams / 4))));
  const [busy, setBusy] = useState(false);
  const base = Math.floor(teams / count);
  const bigger = teams % count;
  const sizes = bigger ? `${bigger} grupo(s) de ${base + 1} y ${count - bigger} de ${base}` : `${count} grupo(s) de ${base}`;

  const submit = async () => {
    setBusy(true);
    try { await onDraw(count); } catch (e) { toast.error(errorMessage(e)); } finally { setBusy(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title="Sortear grupos" size="sm" footer={<>
      <button className="btn-ghost" onClick={onClose}>Cancelar</button>
      <button className="btn-gold" onClick={submit} disabled={busy}>{busy && <Spinner className="h-4 w-4" />}Sortear</button>
    </>}>
      <div className="space-y-4">
        <div>
          <label className="label" htmlFor="draw-count">Cantidad de grupos</label>
          <input id="draw-count" type="number" className="input" min={1} max={max} value={count}
            onChange={(e) => setCount(Math.min(max, Math.max(1, Number(e.target.value) || 1)))} />
          <p className="help">{teams} equipos → {sizes}. El reparto es al azar y lo más parejo posible.</p>
        </div>
        {hasGroups && <Alert tone="warning">Se rehacen los grupos de esta categoría: se borran los actuales, sus partidos en borrador y la llave de eliminación (si existe). No es posible si ya hay partidos enviados.</Alert>}
      </div>
    </Modal>
  );
}
