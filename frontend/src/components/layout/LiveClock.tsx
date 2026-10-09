import { Clock } from "lucide-react";

import { useClock } from "@/hooks";
import { formatClock } from "@/utils/datetime";

/** Hora oficial de Venezuela sincronizada con el servidor. */
export function LiveClock({ className }: { className?: string }) {
  const { now, synced } = useClock();
  return (
    <div className={className} title={synced ? "Sincronizado con el servidor (America/Caracas)" : "Sin sincronizar: hora local"}>
      <span className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold tabular-nums text-slate-600 dark:border-white/10 dark:bg-ink-800 dark:text-slate-300">
        <Clock className="h-3.5 w-3.5 text-gold-500" />
        {formatClock(now)}
        <span className="rounded-md bg-navy-50 px-1.5 py-0.5 text-[10px] text-navy-700 dark:bg-gold-500/10 dark:text-gold-400">VET UTC-4</span>
        <span className={`h-1.5 w-1.5 rounded-full ${synced ? "bg-emerald-500" : "bg-amber-500"}`} />
      </span>
    </div>
  );
}
