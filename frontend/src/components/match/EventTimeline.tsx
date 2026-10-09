import type { MatchEvent } from "@/types";
import { cn } from "@/utils/cn";
import { formatTime } from "@/utils/datetime";
import { EVENT_META } from "@/utils/labels";

/** Cronología del partido. Los eventos anulados se muestran tachados (nunca se borran). */
export function EventTimeline({ events, homeTeamId, showInternal, onAnnul }: {
  events: MatchEvent[]; homeTeamId?: number; showInternal?: boolean; onAnnul?: (event: MatchEvent) => void;
}) {
  const visible = [...events].sort((a, b) => b.sequence - a.sequence);
  if (!visible.length) return <p className="py-8 text-center text-sm text-slate-400">Aún no hay eventos registrados.</p>;
  return (
    <ol className="relative space-y-3 before:absolute before:bottom-2 before:left-[19px] before:top-2 before:w-px before:bg-slate-200 dark:before:bg-white/10">
      {visible.map((event) => {
        const meta = EVENT_META[event.type];
        const isHome = event.team != null && event.team === homeTeamId;
        return (
          <li key={event.id} className="relative flex animate-slide-up gap-3">
            <span className="z-10 grid h-10 w-10 shrink-0 place-items-center rounded-full border border-slate-200 bg-white text-lg shadow-sm dark:border-white/10 dark:bg-ink-700">
              {meta.emoji}
            </span>
            <div className={cn("flex-1 rounded-xl border border-slate-100 bg-white px-3 py-2 dark:border-white/5 dark:bg-ink-700/50", event.annulled && "opacity-50")}>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                {event.minute != null && <span className="font-display text-sm font-bold text-gold-600 dark:text-gold-400">{event.minute}'</span>}
                <span className={cn("text-sm font-semibold", meta.tone, event.annulled && "line-through")}>{event.type_display}</span>
                {event.team_name && <span className={cn("badge", isHome ? "bg-navy-50 text-navy-700 dark:bg-navy-500/20 dark:text-navy-200" : "bg-crimson-50 text-crimson-700 dark:bg-crimson-500/15 dark:text-crimson-300")}>{event.team_name}</span>}
                {event.annulled && <span className="badge bg-crimson-600 text-white">ANULADO</span>}
                <span className="ml-auto text-[11px] text-slate-400">#{event.sequence} · {formatTime(event.created_at)}</span>
              </div>
              {(event.player_name || event.player_in_name) && (
                <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-300">
                  {event.type === "substitution" ? <>Sale <b>{event.player_name}</b> · Entra <b>{event.player_in_name}</b></> : event.player_name}
                </p>
              )}
              {event.type === "annulment" && event.annuls && <p className="text-xs text-slate-500">Anula el evento #{events.find((e) => e.id === event.annuls)?.sequence ?? event.annuls}</p>}
              {showInternal && event.notes && <p className="mt-1 text-xs italic text-slate-500">“{event.notes}”</p>}
              {showInternal && event.recorded_by_name && <p className="mt-0.5 text-[11px] text-slate-400">Registrado por {event.recorded_by_name}</p>}
              {onAnnul && !event.annulled && ["goal", "penalty_goal", "own_goal", "yellow_card", "red_card", "substitution", "incident", "note"].includes(event.type) && (
                <button onClick={() => onAnnul(event)} className="mt-1 text-xs font-semibold text-crimson-600 hover:underline">Anular con motivo</button>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
