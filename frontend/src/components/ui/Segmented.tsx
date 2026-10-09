import type { ReactNode } from "react";

import { cn } from "@/utils/cn";

export interface SegmentedOption<T extends string> {
  value: T;
  label: ReactNode;
  icon?: ReactNode;
  disabled?: boolean;
}

/** Selector de opciones excluyentes en una sola fila (p. ej. «Sin usuario · Vincular · Crear»). */
export function Segmented<T extends string>({ value, onChange, options, className }: {
  value: T; onChange: (value: T) => void; options: SegmentedOption<T>[]; className?: string;
}) {
  return (
    <div role="radiogroup" className={cn("flex w-full gap-1 rounded-xl border border-slate-200 bg-slate-100/70 p-1 dark:border-white/10 dark:bg-ink-900/50", className)}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button key={option.value} type="button" role="radio" aria-checked={active} disabled={option.disabled}
            onClick={() => onChange(option.value)}
            className={cn("flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-40",
              active ? "bg-navy-900 text-white shadow-soft dark:bg-gold-500 dark:text-navy-950"
                : "text-slate-500 hover:bg-white hover:text-slate-800 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-white")}>
            {option.icon}{option.label}
          </button>
        );
      })}
    </div>
  );
}
