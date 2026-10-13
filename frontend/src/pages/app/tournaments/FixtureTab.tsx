import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Shuffle, Trash2 } from "lucide-react";

import { ResourceForm, type FieldDef } from "@/components/forms";
import { Can } from "@/components/layout/Guards";
import { Badge, Card, CardHeader, ConfirmDialog, EmptyState, Modal, SelectMenu, StatusBadge } from "@/components/ui";
import { useCan, useToast } from "@/hooks";
import { groups, matches, registrations } from "@/services";
import type { Match, Registration, Tournament } from "@/types";
import { formatDateTime } from "@/utils/datetime";
import { errorMessage } from "@/utils/errors";

export function FixtureTab({ tournament }: { tournament: Tournament }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [modal, setModal] = useState<"generate" | "manual" | null>(null);
  const [category, setCategory] = useState<number>(tournament.categories[0]);
  const [deleting, setDeleting] = useState<Match | null>(null);
  const canDelete = useCan("competition.delete_match");
  const list = useQuery({ queryKey: ["matches", "tournament", tournament.id, category], queryFn: () => matches.all({ tournament: tournament.id, category, ordering: "round_number" }) });
  const grps = useQuery({ queryKey: ["groups", tournament.id], queryFn: () => groups.all({ tournament: tournament.id, is_active: true }) });
  const regs = useQuery({ queryKey: ["registrations", tournament.id], queryFn: () => registrations.all({ tournament: tournament.id, is_active: true }) });

  // Fase regular por fecha; la eliminación directa por ronda (después de la fase regular).
  const rounds = useMemo(() => {
    const map = new Map<string, { order: number; label: string; items: Match[] }>();
    (list.data ?? []).forEach((m) => {
      const knockout = m.stage !== "regular";
      const key = knockout ? m.stage : `r${m.round_number}`;
      const entry = map.get(key) ?? { order: (knockout ? 1000 : 0) + m.round_number, label: knockout ? m.stage_display : `Fecha ${m.round_number}`, items: [] };
      entry.items.push(m);
      map.set(key, entry);
    });
    return [...map.values()].sort((a, b) => a.order - b.order)
      .map((r) => ({ ...r, items: r.items.sort((a, b) => (a.bracket_position ?? 0) - (b.bracket_position ?? 0)) }));
  }, [list.data]);

  const catOptions = tournament.categories.map((id, i) => ({ value: id, label: tournament.category_names[i] }));
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["matches"] });
  const regOptions = (regs.data ?? []).filter((r: Registration) => r.category === category).map((r) => ({ value: r.id, label: r.team_name }));

  const generateFields: FieldDef[] = [
    { name: "category", label: "Categoría", type: "select", required: true, options: catOptions, defaultValue: category },
    { name: "group", label: "Grupo", type: "select", help: "Vacío = todos los equipos de la categoría",
      options: (grps.data ?? []).map((g) => ({ value: g.id, label: `${g.name} · ${g.category_name}` })) },
    { name: "double", label: "Ida y vuelta", type: "checkbox", placeholder: "Generar ida y vuelta", defaultValue: tournament.modality === "league_double" },
  ];
  const manualFields: FieldDef[] = [
    { name: "home", label: "Local", type: "select", required: true, options: regOptions },
    { name: "away", label: "Visitante", type: "select", required: true, options: regOptions },
    { name: "round_number", label: "Fecha / ronda", type: "number", min: 1, defaultValue: 1 },
    { name: "group", label: "Grupo", type: "select", options: (grps.data ?? []).filter((g) => g.category === category).map((g) => ({ value: g.id, label: g.name })) },
  ];

  return (
    <Card>
      <CardHeader title="Partidos" subtitle="Generados automáticamente (todos contra todos) o creados manualmente"
        actions={<>
          <div className="w-40"><SelectMenu value={category} onChange={(v) => setCategory(Number(v))} options={catOptions} /></div>
          <Can perm="competition.add_match"><button className="btn-outline btn-sm" onClick={() => setModal("manual")}><Plus className="h-4 w-4" /> Partido</button></Can>
          <Can perm="competition.generate_fixture"><button className="btn-gold btn-sm" onClick={() => setModal("generate")}><Shuffle className="h-4 w-4" /> Generar fixture</button></Can>
        </>} />
      {!rounds.length && !list.isLoading && <EmptyState title="Sin partidos" message="Inscriba los equipos y genere el fixture." />}
      <div className="divide-y divide-slate-100 dark:divide-white/5">
        {rounds.map(({ label, items }) => (
          <div key={label} className="px-5 py-4">
            <h4 className="mb-3 text-sm font-bold text-navy-900 dark:text-gold-400">{label}</h4>
            <div className="grid gap-2 md:grid-cols-2">
              {items.map((m) => (
                <Link key={m.id} to={`/app/partidos/${m.id}`} className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 px-3 py-2 text-sm transition hover:border-gold-400 hover:shadow-soft dark:border-white/5">
                  <span className="min-w-0 truncate"><b>{m.home_name}</b> vs <b>{m.away_name}</b>
                    <span className="block text-xs text-slate-500">{m.group_name ?? ""} {m.matchday_label ? `· ${m.matchday_label}` : "· Sin jornada"} · {formatDateTime(m.scheduled_start)}</span></span>
                  <span className="flex shrink-0 items-center gap-2">
                    {m.home_score != null && <Badge tone="navy">{m.home_score}-{m.away_score}</Badge>}
                    <StatusBadge status={m.status} label={m.status_display} />
                    {canDelete && m.status === "draft" && (
                      <button className="btn-ghost btn-sm p-1 text-crimson-600" title="Eliminar partido (borrador)"
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setDeleting(m); }}><Trash2 className="h-4 w-4" /></button>
                    )}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
      <Modal open={modal === "generate"} onClose={() => setModal(null)} title="Generar fixture" subtitle="Método del círculo: cada equipo enfrenta a todos" size="sm">
        <ResourceForm fields={generateFields} submitLabel="Generar" onCancel={() => setModal(null)} onSubmit={async (v) => {
          const res = await matches.generateFixture({ tournament: tournament.id, category: v.category as number, group: (v.group as number) || null, double: Boolean(v.double) });
          toast.success(`${res.created} partidos creados en borrador.`);
          setCategory(v.category as number);
          setModal(null);
          await refresh();
        }} />
      </Modal>
      <ConfirmDialog open={deleting !== null} onClose={() => setDeleting(null)} danger confirmLabel="Eliminar definitivamente" title="Eliminar partido"
        message={deleting ? `Se borrará ${deleting.home_name} vs ${deleting.away_name} (borrador). No se puede deshacer.` : ""}
        onConfirm={async () => {
          if (!deleting) return;
          try { await matches.remove(deleting.id); toast.success("Partido eliminado."); await refresh(); }
          catch (e) { toast.error(errorMessage(e)); throw e; }
        }} />
      <Modal open={modal === "manual"} onClose={() => setModal(null)} title="Nuevo partido" size="sm">
        <ResourceForm fields={manualFields} onCancel={() => setModal(null)} onSubmit={async (v) => {
          await matches.create({ ...v, tournament: tournament.id, category });
          toast.success("Partido creado.");
          setModal(null);
          await refresh();
        }} />
      </Modal>
    </Card>
  );
}
