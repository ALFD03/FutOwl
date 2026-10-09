import { cn } from "@/utils/cn";

/** Isotipo + marca tipográfica. `variant="light"` para fondos oscuros. */
export function Logo({ className, compact, variant = "auto" }: { className?: string; compact?: boolean; variant?: "auto" | "light" }) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <img src="/brand/isotipo-color.png" alt="FutOwl" className="h-9 w-auto drop-shadow-[0_2px_8px_rgba(201,162,39,.35)]" />
      {!compact && (
        <span className="leading-none">
          <span className={cn("block font-display text-xl font-extrabold tracking-tight",
            variant === "light" ? "text-white" : "text-navy-900 dark:text-white")}>
            Fut<span className="gold-text">OWL</span>
          </span>
          <span className={cn("block text-[9px] font-semibold uppercase tracking-[.18em]",
            variant === "light" ? "text-gold-300/80" : "text-slate-500 dark:text-gold-300/70")}>Gestión de torneos</span>
        </span>
      )}
    </span>
  );
}
