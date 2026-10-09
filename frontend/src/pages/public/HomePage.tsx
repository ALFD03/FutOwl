import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { CalendarClock, Lock, Radio, ShieldCheck, Trophy, Zap } from "lucide-react";

import { MatchCard } from "@/components/match/MatchCard";
import { EmptyState, Skeleton } from "@/components/ui";
import { useLiveInterval } from "@/hooks";
import { publicApi } from "@/services";
import { formatDate } from "@/utils/datetime";

const FEATURES = [
  { icon: Radio, title: "Tiempo real", text: "Goles, tarjetas y cambios desde la mesa técnica al instante." },
  { icon: ShieldCheck, title: "Inalterable y auditable", text: "Cada acción queda registrada; nada confirmado se edita ni se borra." },
  { icon: CalendarClock, title: "Jornadas sin solapamientos", text: "Canchas divisibles, oficiales y equipos validados automáticamente." },
  { icon: Lock, title: "Datos protegidos", text: "Cifrado en base de datos, sesiones seguras y permisos por rol." },
];

export function HomePage() {
  const interval = useLiveInterval(15_000);
  const live = useQuery({ queryKey: ["public", "live"], queryFn: publicApi.live, refetchInterval: interval });
  const tournaments = useQuery({ queryKey: ["public", "tournaments"], queryFn: publicApi.tournaments });

  return (
    <div>
      <section className="relative overflow-hidden bg-navy-950 text-white">
        <img src="/brand/banner-isotipo.jpg" alt="" className="absolute inset-0 h-full w-full object-cover opacity-40" />
        <div className="absolute inset-0 bg-gradient-to-r from-navy-950 via-navy-950/85 to-navy-950/30" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-4 py-16 sm:px-6 md:grid-cols-2 md:py-24">
          <div className="animate-slide-up">
            <span className="badge bg-gold-500/15 text-gold-300 ring-1 ring-gold-500/30"><Zap className="h-3.5 w-3.5" /> Gestión de torneos en la nube</span>
            <h1 className="mt-5 text-4xl font-extrabold leading-tight sm:text-5xl">
              Tu torneo, <span className="gold-text">visto con ojos de búho</span>.
            </h1>
            <p className="mt-4 max-w-lg text-lg text-slate-300">
              Partidos, resultados y estadísticas en tiempo real. Jornadas confirmadas, mesa técnica digital y trazabilidad total.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/en-vivo" className="btn-gold px-6 py-3 text-base"><Radio className="h-5 w-5" /> Ver en vivo</Link>
              <Link to="/login" className="btn border border-white/20 px-6 py-3 text-base text-white hover:bg-white/10">Ingresar al panel</Link>
            </div>
          </div>
          <div className="hidden justify-center md:flex">
            <img src="/brand/isotipo.png" alt="FutOwl" className="w-96 animate-scale-in drop-shadow-[0_20px_60px_rgba(201,162,39,.45)]" />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <div className="mb-6 flex items-end justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Partidos de hoy</h2>
            <p className="text-sm text-slate-500">Se actualiza automáticamente · Hora de Venezuela</p>
          </div>
          <Link to="/en-vivo" className="text-sm font-semibold text-navy-700 hover:underline dark:text-gold-400">Ver todos →</Link>
        </div>
        {live.isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-36" />)}</div>
        ) : live.data?.today.length ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{live.data.today.map((m) => <MatchCard key={m.id} match={m} />)}</div>
        ) : (
          <div className="card"><EmptyState title="No hay partidos hoy" message="Consulte el calendario de los torneos más abajo." /></div>
        )}
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-12 sm:px-6">
        <h2 className="mb-6 text-2xl font-bold text-slate-900 dark:text-white">Torneos</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(tournaments.data ?? []).map((t) => (
            <Link key={t.id} to={`/torneos/${t.id}`} className="card card-hover group flex animate-slide-up items-center gap-4 p-5">
              {t.logo ? <img src={t.logo} alt="" className="h-14 w-14 rounded-xl object-contain" /> : (
                <span className="grid h-14 w-14 place-items-center rounded-xl bg-gradient-to-br from-gold-500 to-gold-300 text-navy-950 shadow-gold"><Trophy className="h-7 w-7" /></span>
              )}
              <div className="min-w-0">
                <h3 className="truncate font-bold text-slate-900 group-hover:text-navy-700 dark:text-white dark:group-hover:text-gold-400">{t.name}</h3>
                <p className="text-xs text-slate-500">{t.modality_display} · {t.categories.map((c) => c.name).join(", ")}</p>
                <p className="text-xs text-slate-400">{formatDate(t.start_date)} — {formatDate(t.end_date)}</p>
              </div>
            </Link>
          ))}
          {tournaments.data?.length === 0 && <div className="card sm:col-span-2 lg:col-span-3"><EmptyState title="Aún no hay torneos publicados" /></div>}
        </div>
      </section>

      <section className="border-t border-slate-200 bg-white py-14 dark:border-white/5 dark:bg-ink-800">
        <div className="mx-auto grid max-w-7xl gap-6 px-4 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
          {FEATURES.map((f) => (
            <div key={f.title} className="animate-slide-up rounded-2xl p-5 transition hover:bg-slate-50 dark:hover:bg-white/5">
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-navy-900 text-gold-400 shadow-soft"><f.icon className="h-6 w-6" /></span>
              <h3 className="mt-4 font-bold text-slate-900 dark:text-white">{f.title}</h3>
              <p className="mt-1 text-sm text-slate-500">{f.text}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
