import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, CheckCheck } from "lucide-react";

import { Card, EmptyState, PageHeader, Pagination } from "@/components/ui";
import { notifications } from "@/services";
import { cn } from "@/utils/cn";
import { formatDateTime } from "@/utils/datetime";

const DOT = { info: "bg-navy-500", success: "bg-emerald-500", warning: "bg-gold-500", danger: "bg-crimson-500" };

export function NotificationsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [unread, setUnread] = useState(false);
  const { data } = useQuery({ queryKey: ["notifications", "page", page, unread], queryFn: () => notifications.list({ page, unread: unread ? 1 : undefined }), placeholderData: keepPreviousData });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["notifications"] });
  return (
    <div>
      <PageHeader title="Notificaciones" icon={<Bell className="h-6 w-6" />} actions={<>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="accent-navy-900" checked={unread} onChange={(e) => setUnread(e.target.checked)} /> Solo no leídas</label>
        <button className="btn-outline" onClick={async () => { await notifications.readAll(); await refresh(); }}><CheckCheck className="h-4 w-4" /> Marcar todas</button>
      </>} />
      <Card>
        <ul className="divide-y divide-slate-100 dark:divide-white/5">
          {(data?.results ?? []).map((n) => (
            <li key={n.id}>
              <button className={cn("flex w-full gap-4 px-5 py-4 text-left transition hover:bg-slate-50 dark:hover:bg-white/5", !n.read_at && "bg-gold-50/40 dark:bg-gold-500/5")}
                onClick={async () => { await notifications.read(n.id); await refresh(); if (n.link) navigate(n.link); }}>
                <span className={cn("mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full", DOT[n.level])} />
                <span className="flex-1"><b className="block text-sm">{n.title}</b><span className="text-sm text-slate-600 dark:text-slate-300">{n.message}</span></span>
                <span className="shrink-0 text-xs text-slate-400">{formatDateTime(n.created_at)}</span>
              </button>
            </li>
          ))}
        </ul>
        {data?.results.length === 0 && <EmptyState title="Sin notificaciones" />}
        <Pagination page={page} count={data?.count ?? 0} onChange={setPage} />
      </Card>
    </div>
  );
}
