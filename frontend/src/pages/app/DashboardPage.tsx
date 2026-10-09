import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Activity, BadgeCheck, CalendarDays, Radio, Scale, Shield, Trophy, UsersRound } from "lucide-react";

import { MatchCard } from "@/components/match/MatchCard";
import { Card, CardHeader, DataTable, EmptyState, StatCard } from "@/components/ui";
import { useAuth, useClock, useLiveInterval } from "@/hooks";
import { matches, publicApi, reviewCases, teams } from "@/services";
import type { Match } from "@/types";
import { formatLongDate } from "@/utils/datetime";

import { MATCH_COLUMNS } from "./competition/MatchesPage";

export function DashboardPage() {
  const { user, can } = useAuth();
  const { now } = useClock();
  const navigate = useNavigate();
  const interval = useLiveInterval(15_000);
  const mine = useQuery({ queryKey: ["matches", "mine", "upcoming"], queryFn: () => matches.list({ mine: 1, ordering: "scheduled_start", page_size: 8, status: "" }) });
  const pending = useQuery({ queryKey: ["matches", "mine", "pending"], queryFn: () => matches.list({ mine: 1, status: "pending", page_size: 1 }) });
  const live = useQuery({ queryKey: ["public", "live"], queryFn: publicApi.live, refetchInterval: interval });
  const reviews = useQuery({ queryKey: ["review-cases", "open-count"], queryFn: () => reviewCases.list({ status: "open", page_size: 1 }), enabled: can("competition.view_reviewcase") });
  const teamCount = useQuery({ queryKey: ["teams", "count"], queryFn: () => teams.list({ is_active: true, page_size: 1 }), enabled: can("registry.view_team") });
  const inPlay = live.data?.today.filter((m) => m.status === "in_progress") ?? [];
  const upcoming = (mine.data?.results ?? []).filter((m) => !["closed", "suspended"].includes(m.status));

  const shortcuts = [
    { to: "/app/torneos", label: "Torneos", icon: Trophy, perm: "tournaments.view_tournament" },
    { to: "/app/jornadas", label: "Jornadas", icon: CalendarDays, perm: "competition.view_matchday" },
    { to: "/app/equipos", label: "Equipos", icon: Shield, perm: "registry.view_team" },
    { to: "/app/jugadores", label: "Jugadores", icon: UsersRound, perm: "registry.view_player" },
  ].filter((s) => can(s.perm));

  return (
    <div className="space-y-8">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-navy-950 via-navy-900 to-navy-700 p-6 text-white shadow-lift sm:p-8">
        <img src="/brand/isotipo.png" alt="" className="pointer-events-none absolute -right-6 -top-6 h-48 w-auto opacity-20 sm:h-60" />
        <p className="text-sm capitalize text-gold-300">{formatLongDate(now)}</p>
        <h1 className="mt-1 text-2xl font-bold sm:text-3xl">Hola, {user?.first_name || user?.username} 👋</h1>
        <p className="mt-2 max-w-xl text-slate-300">Resumen de tu actividad en FutOwl. Toda la información se sincroniza en tiempo real con la hora oficial de Venezuela.</p>
        {shortcuts.length > 0 && (
          <div className="mt-6 flex flex-wrap gap-2">
            {shortcuts.map((s) => <Link key={s.to} to={s.to} className="btn border border-white/15 bg-white/5 text-white backdrop-blur hover:bg-white/15"><s.icon className="h-4 w-4 text-gold-400" />{s.label}</Link>)}
          </div>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="En juego ahora" value={inPlay.length} icon={<Radio className="h-5 w-5" />} accent="crimson" hint="Partidos con mesa técnica activa" />
        <StatCard label="Partidos de hoy" value={live.data?.today.length ?? "–"} icon={<Activity className="h-5 w-5" />} accent="navy" />
        <StatCard label="Por confirmar (míos)" value={pending.data?.count ?? "–"} icon={<BadgeCheck className="h-5 w-5" />} accent="gold" hint="Asignaciones pendientes de respuesta" />
        {can("competition.view_reviewcase")
          ? <StatCard label="Revisiones abiertas" value={reviews.data?.count ?? "–"} icon={<Scale className="h-5 w-5" />} accent="emerald" />
          : <StatCard label="Equipos activos" value={teamCount.data?.count ?? "–"} icon={<Shield className="h-5 w-5" />} accent="emerald" />}
      </div>

      {inPlay.length > 0 && (
        <section>
          <h2 className="mb-4 flex items-center gap-2 text-lg font-bold"><span className="h-2.5 w-2.5 animate-pulse-live rounded-full bg-crimson-600" /> En vivo</h2>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{inPlay.map((m) => <MatchCard key={m.id} match={m} />)}</div>
        </section>
      )}

      <Card>
        <CardHeader title="Mis próximas asignaciones" subtitle="Partidos donde participas como delegado, árbitro o gestor de equipo"
          actions={<Link to="/app/mis-partidos" className="btn-ghost btn-sm">Ver todas</Link>} />
        <DataTable<Match> columns={MATCH_COLUMNS} rows={upcoming} loading={mine.isLoading} onRowClick={(m) => navigate(`/app/partidos/${m.id}`)}
          empty={<EmptyState title="Sin asignaciones" message="Cuando te asignen a un partido aparecerá aquí y recibirás una notificación." />} />
      </Card>
    </div>
  );
}
