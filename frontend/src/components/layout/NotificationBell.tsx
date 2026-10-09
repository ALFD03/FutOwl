import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, CheckCheck } from "lucide-react";

import { useLiveInterval } from "@/hooks";
import { notifications } from "@/services";
import { cn } from "@/utils/cn";
import { relativeTime } from "@/utils/datetime";

const DOT = { info: "bg-navy-500", success: "bg-emerald-500", warning: "bg-gold-500", danger: "bg-crimson-500" };

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const interval = useLiveInterval(30_000);
  const { data: count = 0 } = useQuery({ queryKey: ["notifications", "count"], queryFn: notifications.unreadCount, refetchInterval: interval });
  const { data } = useQuery({ queryKey: ["notifications", "latest"], queryFn: () => notifications.list({ page_size: 8 }), enabled: open });

  useEffect(() => {
    const close = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["notifications"] });

  return (
    <div className="relative" ref={ref}>
      <button className="btn-ghost relative h-9 w-9 p-0" onClick={() => setOpen((o) => !o)} aria-label="Notificaciones">
        <Bell className="h-5 w-5" />
        {count > 0 && (
          <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 animate-scale-in place-items-center rounded-full bg-crimson-600 px-1 text-[10px] font-bold text-white">
            {count > 99 ? "99+" : count}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 z-40 mt-2 w-[min(92vw,360px)] animate-scale-in overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lift dark:border-white/10 dark:bg-ink-800">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-white/5">
            <span className="text-sm font-semibold">Notificaciones</span>
            <button className="btn-ghost btn-sm" onClick={async () => { await notifications.readAll(); await refresh(); }}>
              <CheckCheck className="h-4 w-4" /> Marcar leídas
            </button>
          </div>
          <ul className="max-h-96 divide-y divide-slate-100 overflow-y-auto dark:divide-white/5">
            {(data?.results ?? []).map((n) => (
              <li key={n.id}>
                <button className={cn("flex w-full gap-3 px-4 py-3 text-left transition hover:bg-slate-50 dark:hover:bg-white/5", !n.read_at && "bg-gold-50/50 dark:bg-gold-500/5")}
                  onClick={async () => {
                    await notifications.read(n.id);
                    await refresh();
                    setOpen(false);
                    if (n.link) navigate(n.link);
                  }}>
                  <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", DOT[n.level])} />
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-slate-800 dark:text-slate-100">{n.title}</span>
                    <span className="line-clamp-2 block text-xs text-slate-500">{n.message}</span>
                    <span className="mt-1 block text-[11px] text-slate-400">{relativeTime(n.created_at)}</span>
                  </span>
                </button>
              </li>
            ))}
            {data && data.results.length === 0 && <li className="px-4 py-8 text-center text-sm text-slate-400">Sin notificaciones</li>}
          </ul>
          <Link to="/app/notificaciones" onClick={() => setOpen(false)} className="block border-t border-slate-100 px-4 py-2.5 text-center text-xs font-semibold text-navy-700 hover:bg-slate-50 dark:border-white/5 dark:text-gold-400 dark:hover:bg-white/5">
            Ver todas
          </Link>
        </div>
      )}
    </div>
  );
}
