import { Link } from "react-router-dom";
import { MapPin } from "lucide-react";

import { LiveBadge, StatusBadge } from "@/components/ui";
import type { PublicMatch } from "@/types";
import { formatDateTime } from "@/utils/datetime";

import { TeamCrest } from "./TeamCrest";

export function MatchCard({ match }: { match: PublicMatch }) {
  const live = match.status === "in_progress";
  return (
    <Link to={`/partido/${match.id}`} className="card card-hover block animate-slide-up p-4">
      <div className="mb-3 flex items-center justify-between gap-2 text-xs text-slate-500">
        <span className="truncate">{match.tournament_name} · {match.category_name}{match.group_name ? ` · ${match.group_name}` : ""}</span>
        {live ? <LiveBadge /> : <StatusBadge status={match.status} label={match.status_display} />}
      </div>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <span className="flex min-w-0 items-center gap-2"><TeamCrest src={match.home_logo} name={match.home_name} size="sm" /><span className="truncate text-sm font-semibold">{match.home_name}</span></span>
        <span className="rounded-lg bg-navy-900 px-3 py-1 font-display text-lg font-bold tabular-nums text-white dark:bg-white/10">
          {match.score ? `${match.score.home} - ${match.score.away}` : "vs"}
        </span>
        <span className="flex min-w-0 items-center justify-end gap-2"><span className="truncate text-right text-sm font-semibold">{match.away_name}</span><TeamCrest src={match.away_logo} name={match.away_name} size="sm" /></span>
      </div>
      <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
        <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{match.field_name ?? "Por definir"}{match.sub_field && match.sub_field > 1 ? ` (mini ${match.sub_field})` : ""}</span>
        <span>{live && match.score?.minute ? <b className="text-crimson-600">{match.score.minute}'</b> : formatDateTime(match.scheduled_start)}</span>
      </div>
    </Link>
  );
}
