import type { ReactNode } from "react";

import { cn } from "@/utils/cn";

export type Tone = "slate" | "navy" | "gold" | "crimson" | "emerald" | "amber" | "sky";

const TONES: Record<Tone, string> = {
  slate: "bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-slate-300",
  navy: "bg-navy-50 text-navy-800 dark:bg-navy-500/20 dark:text-navy-200",
  gold: "bg-gold-100 text-gold-800 dark:bg-gold-500/15 dark:text-gold-300",
  crimson: "bg-crimson-50 text-crimson-700 dark:bg-crimson-500/15 dark:text-crimson-300",
  emerald: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  amber: "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  sky: "bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
};

export function Badge({ children, tone = "slate", className, dot }: { children: ReactNode; tone?: Tone; className?: string; dot?: boolean }) {
  return (
    <span className={cn("badge", TONES[tone], className)}>
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

const STATUS_TONES: Record<string, Tone> = {
  draft: "slate",
  registration: "sky",
  pending: "amber",
  submitted: "amber",
  confirmed: "emerald",
  in_progress: "crimson",
  finished: "gold",
  closed: "navy",
  suspended: "crimson",
  open: "amber",
  resolved: "emerald",
  dismissed: "slate",
  accepted: "emerald",
  rejected: "crimson",
  verified: "emerald",
  endorsed: "emerald",
  not_endorsed: "slate",
};

export function StatusBadge({ status, label }: { status: string; label?: string }) {
  const live = status === "in_progress";
  return (
    <Badge tone={STATUS_TONES[status] ?? "slate"} dot>
      <span className={live ? "animate-pulse-live" : undefined}>{label ?? status}</span>
    </Badge>
  );
}

export function LiveBadge() {
  return (
    <span className="badge bg-crimson-600 text-white shadow-sm">
      <span className="h-1.5 w-1.5 animate-pulse-live rounded-full bg-white" /> EN VIVO
    </span>
  );
}
