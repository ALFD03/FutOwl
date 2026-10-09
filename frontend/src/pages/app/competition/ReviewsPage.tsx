import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Scale } from "lucide-react";

import { Badge, Card, DataTable, Modal, PageHeader, SelectMenu, Spinner, StatusBadge } from "@/components/ui";
import { useCan, useToast } from "@/hooks";
import { reviewCases } from "@/services";
import type { ReviewCase } from "@/types";
import { formatDateTime } from "@/utils/datetime";
import { errorMessage } from "@/utils/errors";
import { PARTY_LABELS } from "@/utils/labels";

export function ReviewsPage() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const canResolve = useCan("competition.resolve_reviewcase");
  const [status, setStatus] = useState("open");
  const [selected, setSelected] = useState<ReviewCase | null>(null);
  const [resolution, setResolution] = useState("");
  const [busy, setBusy] = useState(false);
  const { data, isLoading } = useQuery({ queryKey: ["review-cases", status], queryFn: () => reviewCases.list({ status: status || undefined, page_size: 100 }) });

  const resolve = async (result: "resolved" | "dismissed") => {
    setBusy(true);
    try {
      await reviewCases.resolve(selected!.id, { status: result, resolution });
      toast.success("Caso resuelto y notificado.");
      setSelected(null);
      setResolution("");
      await queryClient.invalidateQueries({ queryKey: ["review-cases"] });
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageHeader title="Revisiones" subtitle="Rechazos de asignación y apelaciones bajo revisión de las autoridades" icon={<Scale className="h-6 w-6" />}
        actions={<div className="w-44"><SelectMenu value={status} onChange={(v) => setStatus(String(v ?? ""))}
          options={[{ value: "open", label: "Abiertos" }, { value: "resolved", label: "Resueltos" }, { value: "dismissed", label: "Desestimados" }, { value: "", label: "Todos" }]} /></div>} />
      <Card>
        <DataTable<ReviewCase> loading={isLoading} rows={data?.results ?? []} onRowClick={(r) => setSelected(r)} columns={[
          { key: "k", header: "Tipo", render: (r) => <Badge tone={r.kind === "appeal" ? "crimson" : "amber"}>{r.kind_display}</Badge> },
          { key: "m", header: "Partido", render: (r) => <Link to={`/app/partidos/${r.match}`} onClick={(e) => e.stopPropagation()} className="font-semibold hover:underline">{r.match_label}</Link> },
          { key: "p", header: "Parte", render: (r) => r.party ? PARTY_LABELS[r.party] : "—" },
          { key: "r", header: "Motivo", render: (r) => <span className="line-clamp-2 max-w-md text-sm">{r.reason}</span> },
          { key: "u", header: "Por", render: (r) => <span className="text-xs">{r.raised_by_name}<span className="block text-slate-400">{formatDateTime(r.created_at)}</span></span> },
          { key: "s", header: "Estado", render: (r) => <StatusBadge status={r.status} label={r.status_display} /> },
        ]} />
      </Card>
      <Modal open={selected !== null} onClose={() => setSelected(null)} title={selected?.kind_display ?? ""} subtitle={selected?.match_label} footer={selected?.status === "open" && canResolve && (
        <>
          <button className="btn-outline" disabled={busy || resolution.trim().length < 5} onClick={() => resolve("dismissed")}>Desestimar</button>
          <button className="btn-primary" disabled={busy || resolution.trim().length < 5} onClick={() => resolve("resolved")}>{busy && <Spinner className="h-4 w-4" />}Resolver</button>
        </>
      )}>
        {selected && (
          <div className="space-y-4 text-sm">
            <p><b>Motivo:</b> {selected.reason}</p>
            <p className="text-xs text-slate-500">Presentado por {selected.raised_by_name} · {formatDateTime(selected.created_at)}</p>
            {selected.kind === "rejection" && selected.status === "open" && (
              <p className="rounded-xl bg-gold-50 p-3 text-xs text-gold-900 dark:bg-gold-500/10 dark:text-gold-200">
                Para reasignar, use “Ajustar” en el partido (queda la exposición de motivos). Si desestima el rechazo, la parte podrá volver a responder.
              </p>
            )}
            {selected.status === "open" ? (canResolve && (
              <div><label className="label">Resolución</label><textarea className="input min-h-[100px]" value={resolution} onChange={(e) => setResolution(e.target.value)} /></div>
            )) : (
              <div className="rounded-xl bg-slate-50 p-3 dark:bg-white/5"><p><b>Resolución:</b> {selected.resolution}</p><p className="text-xs text-slate-500">{selected.resolved_by_name} · {formatDateTime(selected.resolved_at)}</p></div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
