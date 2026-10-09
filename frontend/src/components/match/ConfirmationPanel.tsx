import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Clock3, Eye, ThumbsDown, ThumbsUp } from "lucide-react";

import { Badge, Card, CardHeader, ConfirmDialog, StatusBadge } from "@/components/ui";
import { useCan, useToast } from "@/hooks";
import { matches } from "@/services";
import type { Match, Party } from "@/types";
import { formatDateTime } from "@/utils/datetime";
import { errorMessage } from "@/utils/errors";
import { PARTY_LABELS } from "@/utils/labels";

/** Estado de confirmación de cada parte y acciones del usuario actual. */
export function ConfirmationPanel({ match }: { match: Match }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const canConfirm = useCan("competition.confirm_assignment");
  const [rejecting, setRejecting] = useState<Party | null>(null);
  const { data } = useQuery({ queryKey: ["matches", match.id, "confirmations"], queryFn: () => matches.confirmations(match.id), refetchInterval: 20_000 });
  const awaiting = match.status === "pending" || match.status === "confirmed";

  const respond = async (party: Party, response: "accepted" | "rejected", reason = "") => {
    try {
      await matches.respond(match.id, { party, response, reason });
      toast.success(response === "accepted" ? "Asistencia confirmada. Su selección quedó bloqueada." : "Rechazo enviado a revisión de las autoridades.");
      await queryClient.invalidateQueries({ queryKey: ["matches"] });
    } catch (e) {
      toast.error(errorMessage(e));
      throw e;
    }
  };

  return (
    <Card>
      <CardHeader title="Confirmaciones de asistencia" subtitle={`Versión de asignación ${match.assignment_version}`} icon={<Check className="h-5 w-5" />} />
      <ul className="divide-y divide-slate-100 dark:divide-white/5">
        {(data?.summary ?? []).map((s) => {
          const mine = data?.my_parties.includes(s.party);
          const official = !["home", "away"].includes(s.party);
          return (
            <li key={s.party} className="flex flex-wrap items-center gap-3 px-5 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{PARTY_LABELS[s.party]} {!official && <span className="text-xs font-normal text-slate-400">(opcional)</span>}</p>
                {s.responded_at && <p className="text-xs text-slate-500">{formatDateTime(s.responded_at)}{s.reason && ` · “${s.reason}”`}</p>}
              </div>
              {s.under_review ? <Badge tone="amber"><Eye className="h-3 w-3" /> En revisión</Badge>
                : s.response ? <StatusBadge status={s.response} label={s.response === "accepted" ? "Confirmado" : "Rechazado"} />
                  : <Badge><Clock3 className="h-3 w-3" /> Pendiente</Badge>}
              {mine && canConfirm && awaiting && s.response !== "accepted" && !s.under_review && (
                <div className="flex gap-2">
                  <button className="btn-primary btn-sm" onClick={() => void respond(s.party, "accepted").catch(() => {})}><ThumbsUp className="h-3.5 w-3.5" /> Confirmar</button>
                  <button className="btn-outline btn-sm text-crimson-600" onClick={() => setRejecting(s.party)}><ThumbsDown className="h-3.5 w-3.5" /> Rechazar</button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {data?.history.length ? (
        <details className="border-t border-slate-100 px-5 py-3 text-xs dark:border-white/5">
          <summary className="cursor-pointer font-semibold text-slate-500">Historial completo ({data.history.length})</summary>
          <ul className="mt-2 space-y-1">
            {data.history.map((h) => <li key={h.id}>{formatDateTime(h.created_at)} · <b>{h.party_display}</b> ({h.username}) → {h.response_display} · v{h.assignment_version}{h.reason && ` · ${h.reason}`}</li>)}
          </ul>
        </details>
      ) : null}
      <ConfirmDialog open={rejecting !== null} onClose={() => setRejecting(null)} title="Rechazar asignación" requireReason minReason={5} danger confirmLabel="Rechazar"
        reasonLabel="Motivo del rechazo" message="Su rechazo y el motivo pasarán a revisión de las autoridades."
        onConfirm={(reason) => respond(rejecting!, "rejected", reason)} />
    </Card>
  );
}
