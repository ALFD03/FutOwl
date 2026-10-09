import type { ReactNode } from "react";

import { cn } from "@/utils/cn";

export function Card({ children, className, hover }: { children: ReactNode; className?: string; hover?: boolean }) {
  return <section className={cn("card animate-slide-up", hover && "card-hover", className)}>{children}</section>;
}

export function CardHeader({ title, subtitle, actions, icon }: {
  title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; icon?: ReactNode;
}) {
  return (
    <header className="card-header">
      <div className="flex min-w-0 items-center gap-3">
        {icon && <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-navy-50 text-navy-700 dark:bg-gold-500/10 dark:text-gold-400">{icon}</span>}
        <div className="min-w-0">
          <h3 className="truncate text-base font-semibold text-slate-900 dark:text-white">{title}</h3>
          {subtitle && <p className="truncate text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  );
}

export function StatCard({ label, value, icon, accent = "navy", hint }: {
  label: string; value: ReactNode; icon: ReactNode; accent?: "navy" | "gold" | "crimson" | "emerald"; hint?: ReactNode;
}) {
  const accents = {
    navy: "from-navy-900 to-navy-700 text-white",
    gold: "from-gold-500 to-gold-300 text-navy-950",
    crimson: "from-crimson-700 to-crimson-500 text-white",
    emerald: "from-emerald-700 to-emerald-500 text-white",
  };
  return (
    <div className="card card-hover animate-slide-up p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</p>
          <p className="mt-2 font-display text-3xl font-bold text-slate-900 dark:text-white">{value}</p>
          {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
        </div>
        <span className={cn("grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br shadow-soft", accents[accent])}>{icon}</span>
      </div>
    </div>
  );
}
