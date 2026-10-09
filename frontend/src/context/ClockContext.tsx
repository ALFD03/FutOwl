/**
 * Reloj sincronizado con el servidor (hora de Venezuela, UTC-4).
 * Calcula el desfase entre el reloj local y el del servidor y lo re-sincroniza periódicamente.
 */
import { createContext, useEffect, useState, type ReactNode } from "react";

import { serverTime } from "@/services";

export interface ClockValue {
  now: Date;
  offsetMs: number;
  synced: boolean;
}

export const ClockContext = createContext<ClockValue>({ now: new Date(), offsetMs: 0, synced: false });

const RESYNC_MS = 5 * 60 * 1000;

export function ClockProvider({ children }: { children: ReactNode }) {
  const [offsetMs, setOffset] = useState(0);
  const [synced, setSynced] = useState(false);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    let cancelled = false;
    const sync = async () => {
      try {
        const started = Date.now();
        const data = await serverTime();
        const latency = (Date.now() - started) / 2;
        if (!cancelled) {
          setOffset(data.epoch_ms + latency - Date.now());
          setSynced(true);
        }
      } catch {
        if (!cancelled) setSynced(false);
      }
    };
    void sync();
    const id = window.setInterval(sync, RESYNC_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date(Date.now() + offsetMs)), 1000);
    return () => window.clearInterval(id);
  }, [offsetMs]);

  return <ClockContext.Provider value={{ now, offsetMs, synced }}>{children}</ClockContext.Provider>;
}
