import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { BadgeCheck } from "lucide-react";

import { Card, DataTable, EmptyState, PageHeader, Pagination, Tabs } from "@/components/ui";
import { matches } from "@/services";
import type { Match } from "@/types";

import { MATCH_COLUMNS } from "./competition/MatchesPage";

type Filter = "pending" | "upcoming" | "history";
const FILTERS: Record<Filter, Record<string, string>> = {
  pending: { status: "pending", ordering: "scheduled_start" },
  upcoming: { status: "confirmed", ordering: "scheduled_start" },
  history: { ordering: "-scheduled_start" },
};

export function MyMatchesPage() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<Filter>("pending");
  const [page, setPage] = useState(1);
  const params = { mine: 1, page, ...FILTERS[filter] };
  const { data, isLoading } = useQuery({ queryKey: ["matches", "mine", params], queryFn: () => matches.list(params), placeholderData: keepPreviousData });
  return (
    <div>
      <PageHeader title="Mis asignaciones" subtitle="Confirma tu asistencia, carga alineaciones u opera la mesa técnica" icon={<BadgeCheck className="h-6 w-6" />} />
      <Tabs<Filter> value={filter} onChange={(f) => { setFilter(f); setPage(1); }} tabs={[
        { id: "pending", label: "Por confirmar" }, { id: "upcoming", label: "Confirmados" }, { id: "history", label: "Todos" },
      ]} />
      <Card>
        <DataTable<Match> columns={MATCH_COLUMNS} rows={data?.results ?? []} loading={isLoading} onRowClick={(m) => navigate(`/app/partidos/${m.id}`)}
          empty={<EmptyState title="Nada por aquí" message="No tienes partidos en esta sección." />} />
        <Pagination page={page} count={data?.count ?? 0} onChange={setPage} />
      </Card>
    </div>
  );
}
