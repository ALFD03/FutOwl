import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Activity } from "lucide-react";

import { MyConfirmationBadge } from "@/components/match/MyConfirmationBadge";
import { TeamCrest } from "@/components/match/TeamCrest";
import { Badge, Card, type Column, DataTable, PageHeader, Pagination, SearchInput, SelectMenu, StatusBadge, Switch } from "@/components/ui";
import { useAuth, useLiveInterval } from "@/hooks";
import { matches, tournaments } from "@/services";
import type { Match } from "@/types";
import { formatDateTime } from "@/utils/datetime";

export const MATCH_COLUMNS: Column<Match>[] = [
  { key: "when", header: "Fecha", render: (m) => <span className="whitespace-nowrap text-xs">{formatDateTime(m.scheduled_start)}</span> },
  { key: "teams", header: "Partido", render: (m) => (
    <span className="flex items-center gap-2 font-semibold">
      <TeamCrest src={m.home_logo} name={m.home_name} size="sm" />{m.home_name}
      <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs tabular-nums dark:bg-white/10">{m.home_score != null ? `${m.home_score}-${m.away_score}` : "vs"}</span>
      {m.away_name}<TeamCrest src={m.away_logo} name={m.away_name} size="sm" />
    </span>
  ) },
  { key: "t", header: "Torneo", render: (m) => <span className="text-xs">{m.tournament_name}<span className="block"><Badge tone="gold">{m.category_name}</Badge></span></span> },
  { key: "f", header: "Cancha", render: (m) => m.field_name ?? "—" },
  { key: "s", header: "Estado", render: (m) => (
    <span className="flex flex-col items-start gap-1">
      <StatusBadge status={m.status} label={m.status_display} />
      <MyConfirmationBadge state={m.my_confirmation} />
    </span>
  ) },
];

/** ¿El usuario puede participar en partidos (oficial con ficha o personal de algún equipo)? */
export function useTakesPart() {
  const { user } = useAuth();
  const p = user?.profiles;
  return Boolean(p && (p.delegate_id || p.referee_id || p.coach_id || p.team_ids.length));
}

const MINE_KEY = "futowl:solo-donde-participo";

/** Filtro «donde participo» (partidos y jornadas): se recuerda en este navegador; solo para quien participa. */
export function useMineFilter() {
  const takesPart = useTakesPart();
  const [mine, setMineState] = useState(() => {
    try { return localStorage.getItem(MINE_KEY) === "1"; } catch { return false; }
  });
  const setMine = (value: boolean) => {
    setMineState(value);
    try { localStorage.setItem(MINE_KEY, value ? "1" : "0"); } catch { /* sin almacenamiento: solo esta vista */ }
  };
  return { takesPart, mine: takesPart && mine, setMine };
}

export function MineSwitch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <Switch className="md:w-auto" checked={checked} onChange={onChange} label="Solo donde participo"
      description="Como oficial asignado o con mi equipo" />
  );
}

export function MatchesPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [tournament, setTournament] = useState("");
  const { takesPart, mine, setMine } = useMineFilter();
  const interval = useLiveInterval(15_000);
  const ts = useQuery({ queryKey: ["tournaments", "all"], queryFn: () => tournaments.all() });
  const params = { page, search, status, tournament, mine: mine ? 1 : undefined, ordering: "-scheduled_start" };
  const { data, isLoading } = useQuery({ queryKey: ["matches", "list", params], queryFn: () => matches.list(params), placeholderData: keepPreviousData, refetchInterval: interval });
  return (
    <div>
      <PageHeader title="Partidos" subtitle="Todos los partidos del sistema" icon={<Activity className="h-6 w-6" />} />
      <Card>
        <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 md:flex-row md:items-center dark:border-white/5">
          <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Buscar equipo…" />
          <div className="md:w-56"><SelectMenu value={tournament || null} clearable placeholder="Todos los torneos" onChange={(v) => { setTournament(v == null ? "" : String(v)); setPage(1); }}
            options={(ts.data ?? []).map((t) => ({ value: String(t.id), label: t.name }))} /></div>
          <div className="md:w-56"><SelectMenu value={status || null} clearable placeholder="Todos los estados" onChange={(v) => { setStatus(v == null ? "" : String(v)); setPage(1); }}
            options={[["draft", "Borrador"], ["pending", "Pendiente"], ["confirmed", "Confirmado"], ["in_progress", "En juego"], ["finished", "Finalizado"], ["closed", "Cerrado"], ["suspended", "Suspendido"]]
              .map(([v, l]) => ({ value: v, label: l }))} /></div>
          {takesPart && <MineSwitch checked={mine} onChange={(v) => { setMine(v); setPage(1); }} />}
        </div>
        <Pagination page={page} count={data?.count ?? 0} onChange={setPage} position="top" />
        <DataTable<Match> columns={MATCH_COLUMNS} rows={data?.results ?? []} loading={isLoading} onRowClick={(m) => navigate(`/app/partidos/${m.id}`)} />
        <Pagination page={page} count={data?.count ?? 0} onChange={setPage} />
      </Card>
    </div>
  );
}
