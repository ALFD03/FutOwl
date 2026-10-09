import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { History, ShieldCheck, ShieldX } from "lucide-react";

import { Alert, Badge, Card, DataTable, Modal, PageHeader, Pagination, SearchInput, Spinner } from "@/components/ui";
import { useCan, useToast } from "@/hooks";
import { auditLogs } from "@/services";
import type { AuditLog } from "@/types";
import { formatDateTime } from "@/utils/datetime";
import { errorMessage } from "@/utils/errors";

const ACTION_TONES: Record<string, "emerald" | "amber" | "crimson" | "navy" | "slate"> = {
  create: "emerald", update: "amber", login: "navy", login_failed: "crimson", login_blocked: "crimson", deactivate: "crimson",
};

export function AuditPage() {
  const toast = useToast();
  const canVerify = useCan("audit.verify_auditlog");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [action, setAction] = useState("");
  const [selected, setSelected] = useState<AuditLog | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [verification, setVerification] = useState<{ valid: boolean; checked: number; broken_at: number | null } | null>(null);
  const params = { page, search, action: action || undefined };
  const { data, isLoading } = useQuery({ queryKey: ["audit", params], queryFn: () => auditLogs.list(params), placeholderData: keepPreviousData });

  const verify = async () => {
    setVerifying(true);
    try { setVerification(await auditLogs.verify()); } catch (e) { toast.error(errorMessage(e)); } finally { setVerifying(false); }
  };

  return (
    <div>
      <PageHeader title="Auditoría" subtitle="Bitácora inalterable de todas las acciones (cadena de hashes SHA-256)" icon={<History className="h-6 w-6" />}
        actions={canVerify && <button className="btn-outline" onClick={verify} disabled={verifying}>{verifying ? <Spinner className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}Verificar integridad</button>} />
      {verification && (
        <div className="mb-6">
          {verification.valid
            ? <Alert tone="success" title="Cadena íntegra"><ShieldCheck className="mr-1 inline h-4 w-4" />{verification.checked} registros verificados sin alteraciones.</Alert>
            : <Alert tone="danger" title="¡Integridad comprometida!"><ShieldX className="mr-1 inline h-4 w-4" />La cadena se rompe en el registro #{verification.broken_at}.</Alert>}
        </div>
      )}
      <Card>
        <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row dark:border-white/5">
          <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Usuario, objeto, acción…" />
          <select className="input sm:w-56" value={action} onChange={(e) => { setAction(e.target.value); setPage(1); }}>
            <option value="">Todas las acciones</option>
            {["create", "update", "deactivate", "activate", "login", "login_failed", "login_blocked", "logout", "submit_matchday", "confirmation_accepted", "confirmation_rejected", "match_event", "submit_lineup", "close_match", "close_matchday", "suspend_match", "update_permissions", "accept_terms", "export_document"]
              .map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        <DataTable<AuditLog> loading={isLoading} rows={data?.results ?? []} onRowClick={setSelected} columns={[
          { key: "id", header: "#", render: (r) => <span className="font-mono text-xs">{r.id}</span> },
          { key: "t", header: "Fecha (VET)", render: (r) => <span className="whitespace-nowrap text-xs">{formatDateTime(r.created_at)}</span> },
          { key: "u", header: "Usuario", render: (r) => <b>{r.username}</b> },
          { key: "a", header: "Acción", render: (r) => <Badge tone={ACTION_TONES[r.action] ?? "slate"}>{r.action}</Badge> },
          { key: "o", header: "Objeto", render: (r) => <span className="text-xs">{r.model && <span className="font-mono text-slate-400">{r.model}#{r.object_id} </span>}{r.object_repr}</span> },
          { key: "ip", header: "IP", render: (r) => <span className="font-mono text-xs">{r.ip_address ?? "—"}</span> },
        ]} />
        <Pagination page={page} count={data?.count ?? 0} onChange={setPage} />
      </Card>
      <Modal open={selected !== null} onClose={() => setSelected(null)} title={`Registro #${selected?.id}`} subtitle={selected && formatDateTime(selected.created_at)} size="lg">
        {selected && (
          <div className="space-y-4 text-sm">
            <div className="grid gap-2 sm:grid-cols-2">
              <p><b>Usuario:</b> {selected.username}</p><p><b>Acción:</b> {selected.action}</p>
              <p><b>Objeto:</b> {selected.app_label}.{selected.model} #{selected.object_id}</p><p><b>IP:</b> {selected.ip_address}</p>
              <p className="sm:col-span-2"><b>Ruta:</b> {selected.method} {selected.path}</p>
              <p className="sm:col-span-2 truncate text-xs text-slate-500"><b>Agente:</b> {selected.user_agent}</p>
            </div>
            <div><p className="label">Cambios</p><pre className="max-h-72 overflow-auto rounded-xl bg-ink-900 p-4 text-xs text-emerald-300">{JSON.stringify(selected.changes, null, 2)}</pre></div>
            <div className="space-y-1 font-mono text-[11px] text-slate-500"><p>prev: {selected.prev_hash}</p><p>hash: {selected.hash}</p></div>
          </div>
        )}
      </Modal>
    </div>
  );
}
