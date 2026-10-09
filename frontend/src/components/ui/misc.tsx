import { useEffect, useState, type ReactNode } from "react";
import { Inbox, Search } from "lucide-react";

import { cn } from "@/utils/cn";
import { useDebounce } from "@/hooks";

export function PageHeader({ title, subtitle, actions, icon }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="mb-6 flex animate-fade-in flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex items-center gap-3">
        {icon && <span className="hidden h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-navy-900 to-navy-700 text-gold-400 shadow-soft sm:grid">{icon}</span>}
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{title}</h1>
          {subtitle && <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function EmptyState({ title = "Sin registros", message, action, icon }: { title?: string; message?: ReactNode; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
      <span className="grid h-14 w-14 place-items-center rounded-2xl bg-slate-100 text-slate-400 dark:bg-white/5">{icon ?? <Inbox className="h-7 w-7" />}</span>
      <h4 className="mt-2 font-semibold text-slate-700 dark:text-slate-200">{title}</h4>
      {message && <p className="max-w-sm text-sm text-slate-500">{message}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: { id: T; label: ReactNode; hidden?: boolean }[]; value: T; onChange: (id: T) => void }) {
  return (
    <div className="mb-5 flex gap-1 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-1 shadow-soft dark:border-white/5 dark:bg-ink-800" role="tablist">
      {tabs.filter((t) => !t.hidden).map((tab) => (
        <button key={tab.id} role="tab" aria-selected={tab.id === value} onClick={() => onChange(tab.id)}
          className={cn("whitespace-nowrap rounded-xl px-4 py-2 text-sm font-semibold transition-all duration-200",
            tab.id === value ? "bg-navy-900 text-white shadow-soft dark:bg-gold-500 dark:text-navy-950"
              : "text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-white")}>
          {tab.label}
        </button>
      ))}
    </div>
  );
}

export function Avatar({ src, name, size = "md", className }: { src?: string | null; name: string; size?: "sm" | "md" | "lg" | "xl"; className?: string }) {
  const sizes = { sm: "h-8 w-8 text-xs", md: "h-10 w-10 text-sm", lg: "h-14 w-14 text-lg", xl: "h-20 w-20 text-2xl" };
  const initials = name.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("");
  if (src) return <img src={src} alt={name} className={cn("shrink-0 rounded-full object-cover ring-2 ring-white dark:ring-ink-700", sizes[size], className)} loading="lazy" />;
  return (
    <span className={cn("grid shrink-0 place-items-center rounded-full bg-gradient-to-br from-navy-800 to-navy-600 font-bold text-gold-300 ring-2 ring-white dark:ring-ink-700", sizes[size], className)}>
      {initials || "?"}
    </span>
  );
}

export function SearchInput({ value, onChange, placeholder = "Buscar…" }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  const [text, setText] = useState(value);
  const debounced = useDebounce(text);
  useEffect(() => {
    if (debounced !== value) onChange(debounced);
  }, [debounced, value, onChange]);
  return (
    <div className="relative w-full sm:w-72">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <input className="input pl-9" value={text} onChange={(e) => setText(e.target.value)} placeholder={placeholder} aria-label="Buscar" />
    </div>
  );
}

export function KeyValue({ items }: { items: { label: string; value: ReactNode }[] }) {
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
      {items.map((item) => (
        <div key={item.label}>
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{item.label}</dt>
          <dd className="mt-1 text-sm text-slate-800 dark:text-slate-100">{item.value ?? "—"}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Alert({ tone = "info", title, children }: { tone?: "info" | "warning" | "danger" | "success"; title?: ReactNode; children?: ReactNode }) {
  const tones = {
    info: "border-navy-200 bg-navy-50 text-navy-900 dark:border-navy-500/30 dark:bg-navy-500/10 dark:text-navy-100",
    warning: "border-gold-300 bg-gold-50 text-gold-900 dark:border-gold-500/30 dark:bg-gold-500/10 dark:text-gold-200",
    danger: "border-crimson-200 bg-crimson-50 text-crimson-800 dark:border-crimson-500/30 dark:bg-crimson-500/10 dark:text-crimson-200",
    success: "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200",
  };
  return (
    <div className={cn("animate-fade-in rounded-xl border px-4 py-3 text-sm", tones[tone])}>
      {title && <p className="font-semibold">{title}</p>}
      {children && <div className={cn(title && "mt-1", "opacity-90")}>{children}</div>}
    </div>
  );
}
