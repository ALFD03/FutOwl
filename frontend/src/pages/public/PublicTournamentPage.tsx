import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Trophy } from "lucide-react";

import { MatchCard } from "@/components/match/MatchCard";
import { StandingsTable } from "@/components/match/StandingsTable";
import { Card, CardHeader, EmptyState, PageHeader, PageLoader, Tabs } from "@/components/ui";
import { useLiveInterval } from "@/hooks";
import { publicApi } from "@/services";
import { formatDate } from "@/utils/datetime";
import { Markdown } from "@/utils/markdown";

type Tab = "standings" | "matches" | "stats" | "rules";

export function PublicTournamentPage() {
  const id = Number(useParams().id);
  const [tab, setTab] = useState<Tab>("standings");
  const [category, setCategory] = useState<number | null>(null);
  const { data: tournament, isLoading } = useQuery({ queryKey: ["public", "tournament", id], queryFn: () => publicApi.tournament(id) });
  const cat = category ?? tournament?.categories[0]?.id ?? null;
  const groups = useMemo(() => tournament?.groups?.filter((g) => g.category === cat) ?? [], [tournament, cat]);
  const interval = useLiveInterval(20_000);

  const standings = useQuery({
    queryKey: ["public", "standings", id, cat, groups.map((g) => g.id)],
    queryFn: async () => {
      if (!groups.length) return [{ name: "General", rows: await publicApi.standings(id, { category: cat!, live: true }) }];
      return Promise.all(groups.map(async (g) => ({ name: g.name, rows: await publicApi.standings(id, { category: cat!, group: g.id, live: true }) })));
    },
    enabled: Boolean(cat) && tab === "standings",
    refetchInterval: interval,
  });
  const matches = useQuery({ queryKey: ["public", "matches", id, cat], queryFn: () => publicApi.matches(id, { category: cat! }), enabled: Boolean(cat) && tab === "matches", refetchInterval: interval });
  const stats = useQuery({ queryKey: ["public", "stats", id, cat], queryFn: () => publicApi.stats(id, cat!), enabled: Boolean(cat) && tab === "stats" });

  if (isLoading) return <PageLoader />;
  if (!tournament) return <EmptyState title="Torneo no disponible" />;

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <PageHeader icon={<Trophy className="h-6 w-6" />} title={tournament.name}
        subtitle={`${tournament.modality_display} · ${formatDate(tournament.start_date)} — ${formatDate(tournament.end_date)}`}
        actions={tournament.categories.length > 1 && (
          <select className="input w-48" value={cat ?? ""} onChange={(e) => setCategory(Number(e.target.value))}>
            {tournament.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        )} />
      <Tabs<Tab> value={tab} onChange={setTab} tabs={[
        { id: "standings", label: "Posiciones" }, { id: "matches", label: "Calendario y resultados" },
        { id: "stats", label: "Estadísticas" }, { id: "rules", label: "Reglamento" },
      ]} />
      {tab === "standings" && (
        <div className="space-y-6">
          {(standings.data ?? []).map((g) => (
            <Card key={g.name}><CardHeader title={g.name} subtitle="Incluye resultados en vivo (no oficiales hasta el cierre)" /><StandingsTable rows={g.rows} /></Card>
          ))}
        </div>
      )}
      {tab === "matches" && (
        matches.data?.length ? <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{matches.data.map((m) => <MatchCard key={m.id} match={m} />)}</div>
          : <div className="card"><EmptyState title="Sin partidos publicados" /></div>
      )}
      {tab === "stats" && (
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader title="Goleadores" />
            <ol className="divide-y divide-slate-100 dark:divide-white/5">
              {(stats.data?.scorers ?? []).map((s, i) => (
                <li key={s.team_player} className="flex items-center gap-3 px-5 py-3 text-sm">
                  <span className="w-6 font-bold text-gold-600">{i + 1}</span>
                  <span className="flex-1"><b>{s.name}</b><span className="block text-xs text-slate-500">{s.team}</span></span>
                  <span className="font-display text-lg font-bold">{s.goals} ⚽</span>
                </li>
              ))}
              {stats.data?.scorers.length === 0 && <li className="px-5 py-8 text-center text-sm text-slate-400">Sin goles registrados</li>}
            </ol>
          </Card>
          <Card>
            <CardHeader title="Disciplina" />
            <ol className="divide-y divide-slate-100 dark:divide-white/5">
              {(stats.data?.discipline ?? []).map((s) => (
                <li key={s.team_player} className="flex items-center gap-3 px-5 py-3 text-sm">
                  <span className="flex-1"><b>{s.name}</b><span className="block text-xs text-slate-500">{s.team}</span></span>
                  <span>{s.yellow} 🟨</span><span>{s.red} 🟥</span>
                </li>
              ))}
              {stats.data?.discipline.length === 0 && <li className="px-5 py-8 text-center text-sm text-slate-400">Sin tarjetas</li>}
            </ol>
          </Card>
        </div>
      )}
      {tab === "rules" && <Card><div className="card-body"><Markdown content={tournament.regulation_text || "Reglamento no publicado."} /></div></Card>}
    </div>
  );
}
