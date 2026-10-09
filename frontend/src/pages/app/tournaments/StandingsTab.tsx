import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { StandingsTable } from "@/components/match/StandingsTable";
import { Card, CardHeader } from "@/components/ui";
import { useLiveInterval } from "@/hooks";
import { groups, standingsService } from "@/services";
import type { Tournament } from "@/types";

export function StandingsTab({ tournament }: { tournament: Tournament }) {
  const [category, setCategory] = useState(tournament.categories[0]);
  const [live, setLive] = useState(true);
  const interval = useLiveInterval(15_000);
  const grps = useQuery({ queryKey: ["groups", tournament.id], queryFn: () => groups.all({ tournament: tournament.id, is_active: true }) });
  const catGroups = (grps.data ?? []).filter((g) => g.category === category);
  const tables = useQuery({
    queryKey: ["standings", tournament.id, category, live, catGroups.map((g) => g.id)],
    queryFn: async () => catGroups.length
      ? Promise.all(catGroups.map(async (g) => ({ name: g.name, rows: await standingsService.get({ tournament: tournament.id, category, group: g.id, live }) })))
      : [{ name: "Tabla general", rows: await standingsService.get({ tournament: tournament.id, category, live }) }],
    enabled: grps.isSuccess,
    refetchInterval: interval,
  });
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <select className="input w-48" value={category} onChange={(e) => setCategory(Number(e.target.value))}>
          {tournament.categories.map((id, i) => <option key={id} value={id}>{tournament.category_names[i]}</option>)}
        </select>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="accent-navy-900" checked={live} onChange={(e) => setLive(e.target.checked)} /> Incluir partidos en curso / sin cerrar</label>
      </div>
      {(tables.data ?? []).map((t) => <Card key={t.name}><CardHeader title={t.name} subtitle={live ? "Incluye resultados no oficiales" : "Solo partidos cerrados (oficial)"} /><StandingsTable rows={t.rows} /></Card>)}
    </div>
  );
}
