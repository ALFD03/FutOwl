import { useQuery } from "@tanstack/react-query";
import { Radio } from "lucide-react";

import { MatchCard } from "@/components/match/MatchCard";
import { EmptyState, PageHeader, Skeleton } from "@/components/ui";
import { useClock, useLiveInterval } from "@/hooks";
import { publicApi } from "@/services";
import { formatLongDate } from "@/utils/datetime";

export function LivePage() {
  const interval = useLiveInterval(5_000);
  const { now } = useClock();
  const { data, isLoading, dataUpdatedAt } = useQuery({ queryKey: ["public", "live"], queryFn: publicApi.live, refetchInterval: interval });
  const live = data?.today.filter((m) => m.status === "in_progress") ?? [];
  const rest = data?.today.filter((m) => m.status !== "in_progress") ?? [];

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <PageHeader icon={<Radio className="h-6 w-6" />} title="En vivo" subtitle={<span className="capitalize">{formatLongDate(now)}</span>}
        actions={<span className="text-xs text-slate-400">Actualizado {dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleTimeString("es-VE", { timeZone: "America/Caracas" }) : "—"}</span>} />
      {isLoading && <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-36" />)}</div>}
      {live.length > 0 && (
        <section className="mb-10">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-bold"><span className="h-2.5 w-2.5 animate-pulse-live rounded-full bg-crimson-600" /> Jugándose ahora</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{live.map((m) => <MatchCard key={m.id} match={m} />)}</div>
        </section>
      )}
      <section className="mb-10">
        <h2 className="mb-4 text-lg font-bold">Hoy</h2>
        {rest.length ? <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{rest.map((m) => <MatchCard key={m.id} match={m} />)}</div>
          : !isLoading && <div className="card"><EmptyState title="Sin más partidos hoy" /></div>}
      </section>
      <section>
        <h2 className="mb-4 text-lg font-bold">Próximos 7 días</h2>
        {data?.upcoming.length ? <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{data.upcoming.map((m) => <MatchCard key={m.id} match={m} />)}</div>
          : !isLoading && <div className="card"><EmptyState title="Sin partidos confirmados próximamente" /></div>}
      </section>
    </div>
  );
}
