import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, MapPin } from "lucide-react";

import { EventTimeline } from "@/components/match/EventTimeline";
import { ScoreBoard } from "@/components/match/ScoreBoard";
import { Card, CardHeader, EmptyState, PageLoader } from "@/components/ui";
import { useLiveInterval } from "@/hooks";
import { publicApi } from "@/services";

export function PublicMatchPage() {
  const { id } = useParams();
  const interval = useLiveInterval(4_000);
  const { data: match, isLoading } = useQuery({
    queryKey: ["public", "match", id],
    queryFn: () => publicApi.match(Number(id)),
    // Refresco en tiempo real solo mientras el partido está activo
    refetchInterval: (query) => (["confirmed", "in_progress", "finished"].includes(query.state.data?.status ?? "") ? interval : false),
  });

  if (isLoading) return <PageLoader />;
  if (!match) return <EmptyState title="Partido no disponible" />;
  const stats = match.stats;
  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <Link to={`/torneos/${match.tournament}`} className="btn-ghost mb-4 -ml-3"><ArrowLeft className="h-4 w-4" /> {match.tournament_name}</Link>
      <ScoreBoard homeName={match.home_name} awayName={match.away_name} homeLogo={match.home_logo} awayLogo={match.away_logo}
        homeScore={match.score?.home} awayScore={match.score?.away} status={match.status} statusLabel={match.status_display}
        phase={match.phase} minute={match.score?.minute} period={match.current_period} start={match.scheduled_start}
        subtitle={`${match.category_name}${match.matchday_label ? ` · ${match.matchday_label}` : ""}`} />
      <p className="mt-3 flex items-center justify-center gap-1 text-sm text-slate-500"><MapPin className="h-4 w-4" /> {match.field_name ?? "Cancha por definir"}</p>
      <div className="mt-6 grid gap-6 md:grid-cols-[1fr_280px]">
        <Card>
          <CardHeader title="Cronología" subtitle="Eventos públicos del partido" />
          <div className="card-body"><EventTimeline events={match.events ?? []} /></div>
        </Card>
        {stats && (
          <Card className="h-fit">
            <CardHeader title="Estadísticas" />
            <div className="card-body space-y-4 text-sm">
              {([["Amarillas", "yellow"], ["Rojas", "red"], ["Cambios", "substitutions"]] as const).map(([label, key]) => (
                <div key={key}>
                  <div className="mb-1 flex justify-between font-semibold"><span>{stats.home[key]}</span><span className="text-slate-500">{label}</span><span>{stats.away[key]}</span></div>
                  <div className="flex h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-white/10">
                    <div className="bg-navy-700 transition-all duration-700 dark:bg-gold-500" style={{ width: `${(stats.home[key] / Math.max(stats.home[key] + stats.away[key], 1)) * 100}%` }} />
                    <div className="ml-auto bg-crimson-500 transition-all duration-700" style={{ width: `${(stats.away[key] / Math.max(stats.home[key] + stats.away[key], 1)) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
