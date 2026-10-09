import type { ReactNode } from "react";

import { cn } from "@/utils/cn";

const SIZES = {
  sm: { rail: "h-5 w-9", knob: "h-4 w-4", on: "translate-x-4" },
  md: { rail: "h-6 w-11", knob: "h-5 w-5", on: "translate-x-5" },
} as const;

/** Solo el interruptor, para tablas o barras compactas. */
export function Toggle({ checked, onChange, disabled, size = "sm", label }: {
  checked: boolean; onChange: (value: boolean) => void; disabled?: boolean; size?: keyof typeof SIZES; label?: string;
}) {
  const dims = SIZES[size];
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} title={label} disabled={disabled}
      onClick={(e) => { e.stopPropagation(); onChange(!checked); }}
      className={cn("relative inline-flex shrink-0 items-center rounded-full transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-400 disabled:cursor-not-allowed disabled:opacity-50",
        dims.rail, checked ? "bg-navy-900 shadow-[0_0_0_3px_rgba(11,31,77,.12)] dark:bg-gold-500 dark:shadow-[0_0_12px_-2px_rgba(201,162,39,.6)]" : "bg-slate-300 dark:bg-white/15")}>
      <span className={cn("absolute left-0.5 rounded-full bg-white shadow-md transition-transform duration-200", dims.knob, checked && dims.on)} />
    </button>
  );
}

/**
 * Interruptor de sí/no con su etiqueta: reemplaza a las casillas de verificación.
 * Toda la tarjeta es clicable y deja ver de un vistazo qué está encendido.
 */
export function Switch({ checked, onChange, label, description, disabled, locked, className, badge }: {
  checked: boolean; onChange: (value: boolean) => void; label: ReactNode; description?: ReactNode; disabled?: boolean;
  /** Fijo por otra regla (p. ej. heredado del rol): se ve con su estado real, pero no se puede cambiar. */
  locked?: boolean; className?: string; badge?: ReactNode;
}) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-readonly={locked} disabled={disabled || locked} onClick={() => onChange(!checked)}
      className={cn("group flex w-full items-center justify-between gap-4 rounded-xl border px-4 py-2.5 text-left transition-all duration-200 disabled:cursor-not-allowed",
        !locked && "disabled:opacity-60", locked && "border-dashed",
        checked ? "border-navy-300 bg-navy-50/70 dark:border-gold-500/40 dark:bg-gold-500/[.08]"
          : "border-slate-200 bg-white hover:border-slate-300 dark:border-white/10 dark:bg-ink-700/40 dark:hover:border-white/20",
        className)}>
      <span className="min-w-0">
        <span className={cn("flex items-center gap-2 text-sm font-medium", checked ? "text-navy-900 dark:text-gold-300" : "text-slate-700 dark:text-slate-200")}>
          {label}{badge}
        </span>
        {description && <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">{description}</span>}
      </span>
      <span className={cn("relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200",
        checked ? "bg-navy-900 dark:bg-gold-500 dark:shadow-[0_0_12px_-2px_rgba(201,162,39,.6)]" : "bg-slate-300 dark:bg-white/15")}>
        <span className={cn("absolute left-0.5 h-5 w-5 rounded-full bg-white shadow-md transition-transform duration-200", checked && "translate-x-5")} />
      </span>
    </button>
  );
}
