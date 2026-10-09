import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, FileCheck2, Lock, Send, Undo2 } from "lucide-react";

import { api } from "@/api/client";
import { FileInput } from "@/components/forms";
import { Alert, Badge, Card, CardHeader, ConfirmDialog, Spinner } from "@/components/ui";
import { useAuth, useToast } from "@/hooks";
import { matches } from "@/services";
import type { Match, MatchReport } from "@/types";
import { cn } from "@/utils/cn";
import { formatDateTime } from "@/utils/datetime";
import { errorMessage } from "@/utils/errors";
import { REPORT_FIELD_LABELS } from "@/utils/labels";

const NUMERIC = ["home_score", "away_score", "home_yellow", "away_yellow", "home_red", "away_red"] as const;
type Role = "delegate" | "referee";

/** Informes de delegado y árbitro: deben coincidir para que la autoridad cierre el partido. */
export function ReportsPanel({ match }: { match: Match }) {
  const { user, can } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [returning, setReturning] = useState<MatchReport | null>(null);
  const [closing, setClosing] = useState(false);
  const { data } = useQuery({ queryKey: ["matches", match.id, "reports"], queryFn: () => matches.reports(match.id), refetchInterval: 15_000 });

  const current = (role: Role) => data?.reports.filter((r) => r.role === role).sort((a, b) => b.version - a.version)[0];
  const isCurrent = (r?: MatchReport) => r && !r.returned;
  const myRoles: Role[] = [];
  if (user?.profiles.delegate_id && user.profiles.delegate_id === match.delegate && can("competition.submit_delegate_report")) myRoles.push("delegate");
  if (user?.profiles.referee_id && user.profiles.referee_id === match.referee && can("competition.submit_referee_report")) myRoles.push("referee");
  const comparison = data?.comparison;
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["matches"] });

  return (
    <div className="space-y-6">
      {match.status === "closed" && <Alert tone="success" title="Partido cerrado"><Lock className="mr-1 inline h-4 w-4" />Resultado oficial {match.home_score} - {match.away_score}. Solo se admiten notas o apelaciones.</Alert>}
      {match.status !== "finished" && match.status !== "closed" && <Alert tone="info">Los informes se habilitan cuando el delegado registra el fin del partido.</Alert>}

      {comparison && (
        <Card>
          <CardHeader title="Comparación" subtitle="Delegado vs árbitro vs cronología de mesa técnica" icon={<FileCheck2 className="h-5 w-5" />}
            actions={comparison.both_submitted && (comparison.coincide ? <Badge tone="emerald"><CheckCircle2 className="h-3 w-3" /> Coinciden</Badge> : <Badge tone="crimson">No coinciden</Badge>)} />
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Dato</th><th className="text-center">Cronología</th><th className="text-center">Delegado</th><th className="text-center">Árbitro</th></tr></thead>
              <tbody>
                {NUMERIC.map((f) => {
                  const d = isCurrent(current("delegate")) ? current("delegate")![f] : null;
                  const r = isCurrent(current("referee")) ? current("referee")![f] : null;
                  const mismatch = d != null && r != null && d !== r;
                  return (
                    <tr key={f} className={cn(mismatch && "bg-crimson-50 dark:bg-crimson-500/10")}>
                      <td>{REPORT_FIELD_LABELS[f]}</td>
                      <td className="text-center tabular-nums">{comparison.events_tally[f]}</td>
                      <td className="text-center font-semibold tabular-nums">{d ?? "—"}</td>
                      <td className="text-center font-semibold tabular-nums">{r ?? "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {comparison.warnings.length > 0 && <div className="px-5 py-3"><Alert tone="warning">{comparison.warnings.join(" ")}</Alert></div>}
          {match.status === "finished" && can("competition.close_match") && (
            <div className="flex justify-end border-t border-slate-100 px-5 py-3 dark:border-white/5">
              <button className="btn-gold" disabled={!comparison.coincide} onClick={() => setClosing(true)}><Lock className="h-4 w-4" /> Cerrar partido</button>
            </div>
          )}
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {(["delegate", "referee"] as Role[]).map((role) => {
          const report = current(role);
          const history = data?.reports.filter((r) => r.role === role) ?? [];
          const canSubmit = myRoles.includes(role) && match.status === "finished" && !isCurrent(report);
          return (
            <Card key={role}>
              <CardHeader title={role === "delegate" ? "Informe del delegado" : "Informe arbitral"} subtitle={report ? `Versión ${report.version}` : "Pendiente"}
                actions={report && isCurrent(report) && match.status === "finished" && can("competition.return_report") && (
                  <button className="btn-outline btn-sm" onClick={() => setReturning(report)}><Undo2 className="h-4 w-4" /> Devolver</button>
                )} />
              <div className="card-body space-y-4">
                {canSubmit ? <ReportForm match={match} role={role} previous={report} onDone={refresh} /> : isCurrent(report) ? <ReportView report={report!} match={match} />
                  : <p className="text-sm text-slate-500">{report?.returned ? "Devuelto para corrección; esperando nueva versión." : "Aún no enviado."}</p>}
                {history.length > 0 && (
                  <details className="text-xs">
                    <summary className="cursor-pointer font-semibold text-slate-500">Historial de versiones ({history.length})</summary>
                    <ul className="mt-2 space-y-1">
                      {history.map((h) => (
                        <li key={h.id}>v{h.version} · {formatDateTime(h.created_at)} · {h.home_score}-{h.away_score} · {h.submitted_by_name}
                          {h.returned && <span className="text-crimson-600"> · devuelto por {h.returned.by}: “{h.returned.reason}”</span>}</li>
                      ))}
                    </ul>
                  </details>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      <ConfirmDialog open={returning !== null} onClose={() => setReturning(null)} title="Devolver informe" requireReason minReason={5} reasonLabel="Motivo de la devolución"
        message="El informe actual se conserva; el autor deberá enviar una nueva versión." confirmLabel="Devolver"
        onConfirm={async (reason) => {
          try { await matches.returnReport(match.id, returning!.id, reason); toast.success("Informe devuelto."); await refresh(); }
          catch (e) { toast.error(errorMessage(e)); throw e; }
        }} />
      <ConfirmDialog open={closing} onClose={() => setClosing(false)} title="Cerrar partido" confirmLabel="Cerrar definitivamente"
        message="El resultado quedará oficial e inalterable. Solo se podrán agregar notas o apelaciones."
        onConfirm={async () => {
          try { await matches.close(match.id); toast.success("Partido cerrado oficialmente."); await refresh(); }
          catch (e) { toast.error(errorMessage(e)); throw e; }
        }} />
    </div>
  );
}

function ReportView({ report, match }: { report: MatchReport; match: Match }) {
  return (
    <div className="text-sm">
      <p className="mb-3 font-display text-3xl font-bold">{report.home_score} - {report.away_score}</p>
      <p className="text-slate-600 dark:text-slate-300">{match.home_name}: 🟨 {report.home_yellow} · 🟥 {report.home_red}</p>
      <p className="text-slate-600 dark:text-slate-300">{match.away_name}: 🟨 {report.away_yellow} · 🟥 {report.away_red}</p>
      {report.observations && <p className="mt-3 rounded-xl bg-slate-50 p-3 italic dark:bg-white/5">{report.observations}</p>}
      {report.attachment && <a href={report.attachment} target="_blank" rel="noreferrer" className="mt-2 inline-block font-semibold text-navy-700 underline dark:text-gold-400">Ver adjunto</a>}
      <p className="mt-3 text-xs text-slate-400">Enviado por {report.submitted_by_name} · {formatDateTime(report.created_at)}</p>
    </div>
  );
}

function ReportForm({ match, role, previous, onDone }: { match: Match; role: Role; previous?: MatchReport; onDone: () => Promise<void> }) {
  const toast = useToast();
  const [values, setValues] = useState<Record<string, number>>(() => Object.fromEntries(NUMERIC.map((f) => [f, previous?.[f] ?? 0])));
  const [observations, setObservations] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    try {
      const form = new FormData();
      form.append("role", role);
      Object.entries(values).forEach(([k, v]) => form.append(k, String(v)));
      form.append("observations", observations);
      if (file) form.append("attachment", file);
      await api.post(`/matches/${match.id}/submit-report/`, form);
      toast.success("Informe enviado. No podrá modificarse salvo devolución de una autoridad.");
      await onDone();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-4">
      {previous?.returned && <Alert tone="warning" title="Informe devuelto">{previous.returned.reason}</Alert>}
      <div className="grid grid-cols-2 gap-3">
        {NUMERIC.map((f) => (
          <div key={f}>
            <label className="label">{REPORT_FIELD_LABELS[f]}</label>
            <input type="number" min={0} className="input" value={values[f]} onChange={(e) => setValues((v) => ({ ...v, [f]: Math.max(0, Number(e.target.value)) }))} />
          </div>
        ))}
      </div>
      <div><label className="label">Observaciones</label><textarea className="input min-h-[90px]" value={observations} onChange={(e) => setObservations(e.target.value)} /></div>
      <div><label className="label">Adjunto (opcional)</label><FileInput value={file} onChange={setFile} accept="application/pdf,image/jpeg,image/png" /></div>
      <button className="btn-primary w-full" onClick={submit} disabled={busy}>{busy ? <Spinner className="h-4 w-4" /> : <Send className="h-4 w-4" />}Enviar informe</button>
    </div>
  );
}
