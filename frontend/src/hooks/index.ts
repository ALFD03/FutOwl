import { useContext, useEffect, useState } from "react";

import { AuthContext } from "@/context/AuthContext";
import { ClockContext } from "@/context/ClockContext";
import { ThemeContext } from "@/context/ThemeContext";
import { ToastContext } from "@/context/ToastContext";

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de AuthProvider");
  return ctx;
}

export function useCan(perm: string | string[], mode: "all" | "any" = "all") {
  return useAuth().can(perm, mode);
}

export const useTheme = () => useContext(ThemeContext);
export const useClock = () => useContext(ClockContext);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast debe usarse dentro de ToastProvider");
  return ctx;
}

export function useDebounce<T>(value: T, delay = 350): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

/** Intervalo de refresco para datos en tiempo real (pausa cuando la pestaña no está visible). */
export function useLiveInterval(ms: number, enabled = true): number | false {
  const [visible, setVisible] = useState(!document.hidden);
  useEffect(() => {
    const handler = () => setVisible(!document.hidden);
    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
  }, []);
  return enabled && visible ? ms : false;
}
