import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, RotateCcw, SlidersHorizontal } from "lucide-react";

import { ResourceForm, type FieldDef } from "@/components/forms";
import { Can } from "@/components/layout/Guards";
import { Badge, Card, CardHeader, ConfirmDialog, DataTable, KeyValue, Modal } from "@/components/ui";
import { useToast } from "@/hooks";
import { categoryRules, tournaments } from "@/services";
import type { CategoryRules, GameRules, ID, Tournament } from "@/types";
import { errorMessage } from "@/utils/errors";

export const RULE_FIELDS: FieldDef[] = [
  { name: "match_duration_minutes", label: "Duración del partido (min)", type: "number", min: 10, max: 150, defaultValue: 60 },
  { name: "periods", label: "Tiempos", type: "number", min: 1, max: 4, defaultValue: 2 },
  { name: "break_minutes", label: "Descanso (min)", type: "number", defaultValue: 10 },
  { name: "max_substitutions", label: "Cambios máximos", type: "number", help: "Vacío = ilimitados" },
  { name: "max_lineup_players", label: "Jugadores por planilla", type: "number", defaultValue: 18 },
  { name: "starters_count", label: "Titulares", type: "number", defaultValue: 11 },
  { name: "referees_required", label: "Árbitros requeridos", type: "number", min: 1, max: 3, defaultValue: 3, help: "3 = terna completa" },
];

const pickRules = (r: GameRules): GameRules => ({
  match_duration_minutes: r.match_duration_minutes, periods: r.periods, break_minutes: r.break_minutes,
  max_substitutions: r.max_substitutions, max_lineup_players: r.max_lineup_players, starters_count: r.starters_count,
  referees_required: r.referees_required,
});

export const rulesSummary = (r: GameRules) => [
  { label: "Duración", value: `${r.match_duration_minutes} min · ${r.periods} tiempos · ${r.break_minutes} min descanso` },
  { label: "Planilla", value: `${r.max_lineup_players} jugadores · ${r.starters_count} titulares` },
  { label: "Cambios", value: r.max_substitutions ?? "Ilimitados" },
  { label: "Árbitros por partido", value: r.referees_required },
];

interface Row { id: ID; category: ID; name: string; own?: CategoryRules; inactive?: CategoryRules }

type Editing = { kind: "general" } | { kind: "category"; row: Row };

export function RulesTab({ tournament }: { tournament: Tournament }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<Editing | null>(null);
  const [resetting, setResetting] = useState<Row | null>(null);
  const rules = useQuery({ queryKey: ["category-rules", tournament.id], queryFn: () => categoryRules.all({ tournament: tournament.id }) });

  const rows: Row[] = tournament.categories.map((id, i) => {
    const mine = (rules.data ?? []).filter((r) => r.category === id);
    return { id, category: id, name: tournament.category_names[i], own: mine.find((r) => r.is_active), inactive: mine.find((r) => !r.is_active) };
  });
  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["category-rules"] });
    await queryClient.invalidateQueries({ queryKey: ["tournaments"] });
    await queryClient.invalidateQueries({ queryKey: ["matches"] });
  };

  const save = async (values: Record<string, unknown>) => {
    if (!editing) return;
    if (editing.kind === "general") {
      await tournaments.update(tournament.id, values);
      toast.success("Reglas generales actualizadas.");
    } else {
      const { row } = editing;
      if (row.own) await categoryRules.update(row.own.id, values);
      else if (row.inactive) {
        // Las reglas no se borran: se reactivan las que la categoría tuvo antes, con los valores nuevos.
        await categoryRules.activate(row.inactive.id);
        await categoryRules.update(row.inactive.id, values);
      } else await categoryRules.create({ ...values, tournament: tournament.id, category: row.category });
      toast.success(`Reglas de ${row.name} guardadas.`);
    }
    setEditing(null);
    await refresh();
  };

  const resetToGeneral = async () => {
    if (!resetting?.own) return;
    try {
      await categoryRules.deactivate(resetting.own.id);
      toast.success(`${resetting.name} vuelve a las reglas generales.`);
      await refresh();
    } catch (e) {
      toast.error(errorMessage(e));
      throw e;
    }
  };

  const initial = !editing ? null
    : editing.kind === "general" ? pickRules(tournament)
    : pickRules(editing.row.own ?? tournament);

  return (
    <div className="grid gap-6 xl:grid-cols-[340px_1fr]">
      <Card className="h-fit">
        <CardHeader title="Reglas generales" subtitle="Para las categorías sin reglas propias" icon={<SlidersHorizontal className="h-4 w-4" />}
          actions={<Can perm="tournaments.change_tournament"><button className="btn-outline btn-sm" onClick={() => setEditing({ kind: "general" })}><Pencil className="h-4 w-4" /> Editar</button></Can>} />
        <div className="card-body"><KeyValue items={rulesSummary(tournament)} /></div>
      </Card>
      <Card>
        <CardHeader title="Por categoría" subtitle="Cada partido usa las reglas de su categoría" />
        <DataTable<Row> loading={rules.isLoading} rows={rows} columns={[
          { key: "cat", header: "Categoría", render: (r) => <span className="flex flex-wrap items-center gap-2"><Badge tone="gold">{r.name}</Badge>
            {r.own ? <Badge tone="navy">Propias</Badge> : <span className="text-xs text-slate-500">Generales</span>}</span> },
          { key: "duration", header: "Duración", render: (r) => { const x = r.own ?? tournament; return `${x.match_duration_minutes} min · ${x.periods} T · ${x.break_minutes}′ desc.`; } },
          { key: "lineup", header: "Planilla", render: (r) => { const x = r.own ?? tournament; return `${x.max_lineup_players} / ${x.starters_count} tit.`; } },
          { key: "subs", header: "Cambios", render: (r) => (r.own ?? tournament).max_substitutions ?? "Ilimitados" },
          { key: "refs", header: "Árbitros", render: (r) => (r.own ?? tournament).referees_required },
          { key: "actions", header: "", render: (r) => (
            <span className="flex justify-end gap-2">
              {r.own ? <>
                <Can perm="tournaments.change_categoryrules">
                  <button className="btn-ghost btn-sm" onClick={() => setEditing({ kind: "category", row: r })}><Pencil className="h-4 w-4" /> Editar</button>
                  <button className="btn-ghost btn-sm" onClick={() => setResetting(r)}><RotateCcw className="h-4 w-4" /> Usar generales</button>
                </Can>
              </> : (
                <Can perm={r.inactive ? "tournaments.change_categoryrules" : "tournaments.add_categoryrules"}>
                  <button className="btn-outline btn-sm" onClick={() => setEditing({ kind: "category", row: r })}><SlidersHorizontal className="h-4 w-4" /> Personalizar</button>
                </Can>
              )}
            </span>
          ) },
        ]} />
      </Card>

      <Modal open={editing !== null} onClose={() => setEditing(null)} size="sm"
        title={editing?.kind === "category" ? `Reglas de ${editing.row.name}` : "Reglas generales"}>
        {editing && <ResourceForm key={editing.kind === "category" ? editing.row.category : "general"} fields={RULE_FIELDS}
          initial={initial as unknown as Record<string, unknown>} onCancel={() => setEditing(null)} onSubmit={save} />}
      </Modal>
      <ConfirmDialog open={resetting !== null} onClose={() => setResetting(null)} onConfirm={resetToGeneral}
        title="Usar reglas generales" confirmLabel="Usar generales"
        message={`${resetting?.name ?? ""} dejará de tener reglas propias y usará las generales del torneo.`} />
    </div>
  );
}
