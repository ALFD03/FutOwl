import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, Plus, Trash2, Wand2, X } from "lucide-react";

import { ResourceForm, type FieldDef } from "@/components/forms";
import { Can } from "@/components/layout/Guards";
import { Card, CardHeader, ConfirmDialog, DataTable, Modal, PageHeader, SelectMenu, StatusBadge } from "@/components/ui";
import { useCan, useToast } from "@/hooks";
import { matchdays, tournaments } from "@/services";
import type { Matchday, Tournament } from "@/types";
import { formatDate } from "@/utils/datetime";
import { errorMessage } from "@/utils/errors";

import { AutoScheduleModal } from "./AutoScheduleModal";

export function MatchdaysList({ tournamentId }: { tournamentId?: number }) {
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const canDelete = useCan("competition.delete_matchday");
  const [status, setStatus] = useState("");
  const { data, isLoading } = useQuery({
    queryKey: ["matchdays", tournamentId, status],
    queryFn: () => matchdays.all({ tournament: tournamentId, status, ordering: "-date" }),
  });
  // Solo las jornadas en borrador se pueden eliminar.
  const drafts = (data ?? []).filter((m) => m.status === "draft");
  const allChosen = drafts.length > 0 && drafts.every((m) => selected.has(m.id));
  const toggle = (id: number) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const chosen = drafts.filter((m) => selected.has(m.id));
  const removeSelected = async () => {
    try {
      // La API borra por torneo: en la vista general puede haber jornadas de varios torneos.
      const byTournament = new Map<number, number[]>();
      chosen.forEach((m) => byTournament.set(m.tournament, [...(byTournament.get(m.tournament) ?? []), m.id]));
      let deleted = 0;
      for (const [tournament, ids] of byTournament) deleted += (await matchdays.bulkDelete(tournament, ids)).deleted;
      toast.success(`${deleted} jornada(s) eliminada(s). Sus partidos volvieron al fixture sin programar.`);
      setSelected(new Set());
      await queryClient.invalidateQueries({ queryKey: ["matchdays"] });
      await queryClient.invalidateQueries({ queryKey: ["matches"] });
    } catch (e) { toast.error(errorMessage(e)); throw e; }
  };
  const fields: FieldDef[] = [
    ...(tournamentId ? [] : [{ name: "tournament", label: "Torneo", type: "select", required: true, wide: true,
      source: { service: tournaments, label: (t: Tournament) => t.name } } as FieldDef]),
    { name: "number", label: "Número de jornada", type: "number", required: true, min: 1, defaultValue: (data?.length ?? 0) + 1 },
    { name: "date", label: "Día de jornada", type: "date", required: true },
    { name: "name", label: "Nombre (opcional)", type: "text", wide: true, placeholder: "Jornada 1 · Apertura" },
  ];
  return (
    <Card>
      <CardHeader title="Jornadas" subtitle="Borrador → enviada → válida (confirmada) → cerrada" icon={<CalendarDays className="h-5 w-5" />}
        actions={<>
          <div className="w-44"><SelectMenu value={status || null} clearable placeholder="Todos los estados" onChange={(v) => setStatus(v == null ? "" : String(v))}
            options={[{ value: "draft", label: "Borrador" }, { value: "submitted", label: "Enviada" }, { value: "confirmed", label: "Válida" }, { value: "closed", label: "Cerrada" }]} /></div>
          <Can perm={["competition.add_matchday", "competition.change_match"]}><button className="btn-outline btn-sm" onClick={() => setGenerating(true)}><Wand2 className="h-4 w-4" /> Generar jornadas</button></Can>
          <Can perm="competition.add_matchday"><button className="btn-gold btn-sm" onClick={() => setCreating(true)}><Plus className="h-4 w-4" /> Jornada</button></Can>
        </>} />
      {canDelete && drafts.length > 0 && (
        <div className={`flex flex-wrap items-center gap-3 border-b border-slate-100 px-5 py-2 text-sm dark:border-white/5 ${selected.size ? "bg-gold-50/80 dark:bg-gold-500/10" : ""}`}>
          <label className="flex cursor-pointer items-center gap-2 font-semibold text-navy-700 dark:text-gold-400">
            <input type="checkbox" className="h-4 w-4 accent-navy-700" checked={allChosen}
              onChange={() => setSelected(allChosen ? new Set() : new Set(drafts.map((m) => m.id)))} />
            {allChosen ? "Quitar selección" : `Seleccionar todas las jornadas en borrador (${drafts.length})`}
          </label>
          {chosen.length > 0 && (
            <>
              <span className="text-slate-500">{chosen.length} seleccionada(s)</span>
              <button className="btn-sm btn-outline border-crimson-300 text-crimson-600" onClick={() => setDeleting(true)}><Trash2 className="h-4 w-4" /> Eliminar</button>
              <button className="btn-ghost btn-sm" onClick={() => setSelected(new Set())}><X className="h-4 w-4" /> Limpiar</button>
            </>
          )}
        </div>
      )}
      <DataTable<Matchday> paginate loading={isLoading} rows={data ?? []} onRowClick={(r) => navigate(`/app/jornadas/${r.id}`)} columns={[
        ...(canDelete && drafts.length ? [{ key: "sel", header: "", className: "w-10", render: (r: Matchday) => r.status === "draft"
          ? <input type="checkbox" className="h-4 w-4 accent-navy-700" checked={selected.has(r.id)} aria-label={`Seleccionar ${r.name || `Jornada ${r.number}`}`}
            onClick={(e) => e.stopPropagation()} onChange={() => toggle(r.id)} />
          : null }] : []),
        { key: "n", header: "Jornada", render: (r) => <span><b>{r.name || `Jornada ${r.number}`}</b><span className="block text-xs text-slate-500">N.º {r.number}</span></span> },
        ...(tournamentId ? [] : [{ key: "t", header: "Torneo", render: (r: Matchday) => r.tournament_name }]),
        { key: "d", header: "Día", render: (r) => formatDate(r.date) },
        { key: "m", header: "Partidos", render: (r) => r.match_count },
        { key: "s", header: "Estado", render: (r) => <StatusBadge status={r.status} label={r.status_display} /> },
      ]} />
      <ConfirmDialog open={deleting} onClose={() => setDeleting(false)} danger confirmLabel="Eliminar definitivamente"
        title={`Eliminar ${chosen.length} jornada(s)`}
        message="Se eliminan las jornadas en borrador seleccionadas. Sus partidos vuelven al fixture sin jornada, cancha ni horario, listos para programarse de nuevo. No se puede deshacer."
        onConfirm={removeSelected} />
      {generating && <AutoScheduleModal tournamentId={tournamentId} onClose={() => setGenerating(false)}
        onCreated={async () => { setGenerating(false); await queryClient.invalidateQueries({ queryKey: ["matchdays"] }); await queryClient.invalidateQueries({ queryKey: ["matches"] }); }} />}
      <Modal open={creating} onClose={() => setCreating(false)} title="Nueva jornada" subtitle="Queda en borrador hasta completar todos los campos" size="sm">
        <ResourceForm fields={fields} onCancel={() => setCreating(false)} onSubmit={async (v) => {
          const md = await matchdays.create({ ...v, tournament: tournamentId ?? v.tournament });
          toast.success("Jornada creada en borrador.");
          setCreating(false);
          await queryClient.invalidateQueries({ queryKey: ["matchdays"] });
          navigate(`/app/jornadas/${md.id}`);
        }} />
      </Modal>
    </Card>
  );
}

export function MatchdaysPage() {
  return (
    <div>
      <PageHeader title="Jornadas" subtitle="Calendario de partidos con canchas, horarios y oficiales" icon={<CalendarDays className="h-6 w-6" />} />
      <MatchdaysList />
    </div>
  );
}
