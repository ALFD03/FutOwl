import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, RotateCcw, SlidersHorizontal } from "lucide-react";

import { ResourceForm } from "@/components/forms";
import { Can } from "@/components/layout/Guards";
import { Badge, Card, CardHeader, ConfirmDialog, DataTable, Modal } from "@/components/ui";
import { pickRules, RULE_FIELDS } from "@/config/gameRules";
import { useToast } from "@/hooks";
import { categories, categoryRules } from "@/services";
import type { Category, CategoryRules, GameRules, ID, Tournament } from "@/types";
import { errorMessage } from "@/utils/errors";

/** Una fila por categoría del torneo: sus reglas base y, si las hay, el ajuste propio de este torneo. */
interface Row { id: ID; name: string; base?: Category; own?: CategoryRules; inactive?: CategoryRules }

const effective = (r: Row): GameRules | undefined => r.own ?? r.base;

export function RulesTab({ tournament }: { tournament: Tournament }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<Row | null>(null);
  const [resetting, setResetting] = useState<Row | null>(null);
  const cats = useQuery({ queryKey: ["categories", "all"], queryFn: () => categories.all() });
  const rules = useQuery({ queryKey: ["category-rules", tournament.id], queryFn: () => categoryRules.all({ tournament: tournament.id }) });

  const rows: Row[] = tournament.categories.map((id, i) => {
    const mine = (rules.data ?? []).filter((r) => r.category === id);
    return { id, name: tournament.category_names[i], base: cats.data?.find((c) => c.id === id),
      own: mine.find((r) => r.is_active), inactive: mine.find((r) => !r.is_active) };
  });
  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["category-rules"] });
    await queryClient.invalidateQueries({ queryKey: ["matches"] });
  };

  const save = async (values: Record<string, unknown>) => {
    if (!editing) return;
    if (editing.own) await categoryRules.update(editing.own.id, values);
    else if (editing.inactive) {
      // Los ajustes no se borran: se reactiva el que la categoría tuvo antes, con los valores nuevos.
      await categoryRules.activate(editing.inactive.id);
      await categoryRules.update(editing.inactive.id, values);
    } else await categoryRules.create({ ...values, tournament: tournament.id, category: editing.id });
    toast.success(`Reglas de ${editing.name} ajustadas para este torneo.`);
    setEditing(null);
    await refresh();
  };

  const resetToCategory = async () => {
    if (!resetting?.own) return;
    try {
      await categoryRules.deactivate(resetting.own.id);
      toast.success(`${resetting.name} vuelve a las reglas de la categoría.`);
      await refresh();
    } catch (e) {
      toast.error(errorMessage(e));
      throw e;
    }
  };

  const cell = (r: Row, render: (x: GameRules) => string) => { const x = effective(r); return x ? render(x) : "—"; };

  return (
    <Card>
      <CardHeader title="Reglas de juego por categoría" icon={<SlidersHorizontal className="h-4 w-4" />}
        subtitle="Cada categoría trae sus reglas (Registro → Categorías). Aquí puede ajustarlas solo para este torneo." />
      <DataTable<Row> paginate loading={rules.isLoading || cats.isLoading} rows={rows} columns={[
        { key: "cat", header: "Categoría", render: (r) => <span className="flex flex-wrap items-center gap-2"><Badge tone="gold">{r.name}</Badge>
          {r.own ? <Badge tone="navy">Ajustadas en este torneo</Badge> : <span className="text-xs text-slate-500">Las de la categoría</span>}</span> },
        { key: "duration", header: "Duración", render: (r) => cell(r, (x) => `${x.match_duration_minutes} min · ${x.periods} T · ${x.break_minutes}′ desc.`) },
        { key: "lineup", header: "Planilla", render: (r) => cell(r, (x) => `${x.max_lineup_players} / ${x.starters_count} tit.`) },
        { key: "subs", header: "Cambios", render: (r) => cell(r, (x) => String(x.max_substitutions ?? "Ilimitados")) },
        { key: "refs", header: "Árbitros", render: (r) => cell(r, (x) => String(x.referees_required)) },
        { key: "actions", header: "", render: (r) => (
          <span className="flex justify-end gap-2">
            {r.own ? (
              <Can perm="tournaments.change_categoryrules">
                <button className="btn-ghost btn-sm" onClick={() => setEditing(r)}><Pencil className="h-4 w-4" /> Editar</button>
                <button className="btn-ghost btn-sm" onClick={() => setResetting(r)}><RotateCcw className="h-4 w-4" /> Usar las de la categoría</button>
              </Can>
            ) : (
              <Can perm={r.inactive ? "tournaments.change_categoryrules" : "tournaments.add_categoryrules"}>
                <button className="btn-outline btn-sm" disabled={!r.base} onClick={() => setEditing(r)}><SlidersHorizontal className="h-4 w-4" /> Ajustar para este torneo</button>
              </Can>
            )}
          </span>
        ) },
      ]} />

      <Modal open={editing !== null} onClose={() => setEditing(null)} size="sm" title={`Reglas de ${editing?.name ?? ""}`}
        subtitle="Solo para este torneo; la categoría no cambia">
        {editing && <ResourceForm key={editing.id} fields={RULE_FIELDS}
          initial={(editing.own ?? editing.base ? pickRules((editing.own ?? editing.base)!) : null) as unknown as Record<string, unknown>}
          onCancel={() => setEditing(null)} onSubmit={save} />}
      </Modal>
      <ConfirmDialog open={resetting !== null} onClose={() => setResetting(null)} onConfirm={resetToCategory}
        title="Usar las reglas de la categoría" confirmLabel="Usar las de la categoría"
        message={`${resetting?.name ?? ""} dejará de tener reglas propias en este torneo y usará las de la categoría.`} />
    </Card>
  );
}
