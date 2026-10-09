import { createContext, useCallback, useState, type ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from "lucide-react";

import { cn } from "@/utils/cn";

type ToastKind = "success" | "error" | "info" | "warning";
interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}

export interface ToastApi {
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
  warning: (message: string) => void;
}

export const ToastContext = createContext<ToastApi | null>(null);

const ICONS = { success: CheckCircle2, error: XCircle, info: Info, warning: AlertTriangle };
const STYLES: Record<ToastKind, string> = {
  success: "border-emerald-500/30 text-emerald-700 dark:text-emerald-300",
  error: "border-crimson-500/30 text-crimson-700 dark:text-crimson-300",
  info: "border-navy-500/30 text-navy-700 dark:text-navy-200",
  warning: "border-gold-500/40 text-gold-800 dark:text-gold-300",
};

let counter = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: number) => setToasts((all) => all.filter((t) => t.id !== id)), []);
  const push = useCallback(
    (kind: ToastKind) => (message: string) => {
      const id = ++counter;
      setToasts((all) => [...all.slice(-3), { id, kind, message }]);
      window.setTimeout(() => dismiss(id), kind === "error" ? 7000 : 4000);
    },
    [dismiss],
  );

  const api: ToastApi = { success: push("success"), error: push("error"), info: push("info"), warning: push("warning") };

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-[min(92vw,380px)] flex-col gap-2" aria-live="polite">
        {toasts.map((toast) => {
          const Icon = ICONS[toast.kind];
          return (
            <div
              key={toast.id}
              role="status"
              className={cn(
                "pointer-events-auto flex animate-slide-up items-start gap-3 rounded-xl border bg-white/95 p-3 text-sm shadow-lift backdrop-blur dark:bg-ink-800/95",
                STYLES[toast.kind],
              )}
            >
              <Icon className="mt-0.5 h-5 w-5 shrink-0" />
              <p className="flex-1 text-slate-700 dark:text-slate-200">{toast.message}</p>
              <button onClick={() => dismiss(toast.id)} className="text-slate-400 hover:text-slate-600" aria-label="Cerrar">
                <X className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
