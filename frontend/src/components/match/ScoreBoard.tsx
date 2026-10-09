import { LiveBadge, StatusBadge } from "@/components/ui";
import type { MatchPhase, MatchStatus } from "@/types";
import { formatDateTime } from "@/utils/datetime";

import { TeamCrest } from "./TeamCrest";

export interface ScoreBoardProps {
  homeName: string;
  awayName: string;
  homeLogo?: string | null;
  awayLogo?: string | null;
  homeScore?: number | null;
  awayScore?: number | null;
  status: MatchStatus;
  statusLabel: string;
  phase?: MatchPhase;
  minute?: number | null;
  period?: number;
  start?: string | null;
  subtitle?: string;
}

/** Marcador principal con estética de transmisión. */
export function ScoreBoard(p: ScoreBoardProps) {
  const live = p.status === "in_progress";
  const showScore = p.homeScore != null && p.awayScore != null;
  return (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-navy-950 via-navy-900 to-navy-800 p-6 text-white shadow-lift sm:p-8">
      <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-gold-500/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 -left-10 h-56 w-56 rounded-full bg-crimson-600/20 blur-3xl" />
      <div className="relative mb-4 flex flex-wrap items-center justify-center gap-2 text-xs text-slate-300">
        {live ? <LiveBadge /> : <StatusBadge status={p.status} label={p.statusLabel} />}
        {p.subtitle && <span>{p.subtitle}</span>}
      </div>
      <div className="relative grid grid-cols-[1fr_auto_1fr] items-center gap-3 sm:gap-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <TeamCrest src={p.homeLogo} name={p.homeName} size="lg" />
          <span className="font-display text-sm font-bold sm:text-lg">{p.homeName}</span>
        </div>
        <div className="text-center">
          {showScore ? (
            <div key={`${p.homeScore}-${p.awayScore}`} className="animate-scale-in font-display text-5xl font-extrabold tabular-nums tracking-tight sm:text-6xl">
              {p.homeScore}<span className="mx-2 text-gold-400">:</span>{p.awayScore}
            </div>
          ) : (
            <div className="font-display text-3xl font-bold text-gold-400">VS</div>
          )}
          <div className="mt-2 text-xs font-semibold text-gold-300">
            {live && p.phase === "playing" && p.minute != null && <span className="animate-pulse-live">{p.minute}' · {p.period}º tiempo</span>}
            {live && p.phase === "break" && "Descanso"}
            {!live && p.start && formatDateTime(p.start)}
          </div>
        </div>
        <div className="flex flex-col items-center gap-3 text-center">
          <TeamCrest src={p.awayLogo} name={p.awayName} size="lg" />
          <span className="font-display text-sm font-bold sm:text-lg">{p.awayName}</span>
        </div>
      </div>
    </div>
  );
}
