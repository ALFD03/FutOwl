import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { DateTimeInput } from "@/components/forms";
import { Alert, Modal, Spinner } from "@/components/ui";
import { useToast } from "@/hooks";
import { delegates, fields as fieldsService, matches, referees } from "@/services";
import type { Match } from "@/types";
import { errorMessage } from "@/utils/errors";

/** Ajuste de un partido ya enviado: requiere exposición de motivos; conserva el historial. */
export function AdjustDialog({ match, open, onClose }: { match: Match; open: boolean; onClose: () => void }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    field: match.field, scheduled_start: match.scheduled_start, scheduled_end: match.scheduled_end, delegate: match.delegate,
    referee: match.referee, assistant_referee_1: match.assistant_referee_1, assistant_referee_2: match.assistant_referee_2,
  });
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const fieldsQ = useQuery({ queryKey: ["options", "fields"], queryFn: () => fieldsService.all({ is_active: true }), enabled: open });
  const delegatesQ = useQuery({ queryKey: ["options", "delegates"], queryFn: () => delegates.all({ is_active: true }), enabled: open });
  const refereesQ = useQuery({ queryKey: ["options", "referees"], queryFn: () => referees.all({ is_active: true }), enabled: open });

  const changes = Object.fromEntries(Object.entries(form).filter(([k, v]) => v !== match[k as keyof Match]));
  const submit = async () => {
    setBusy(true);
    try {
      await matches.adjust(match.id, { ...changes, reason });
      toast.success("Ajuste registrado. Las partes afectadas deben volver a confirmar.");
      await queryClient.invalidateQueries({ queryKey: ["matches"] });
      onClose();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const select = (key: keyof typeof form, options: { id: number; label: string }[]) => (
    <select className="input" value={(form[key] as number | null) ?? ""} onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value ? Number(e.target.value) : null }))}>
      <option value="">—</option>
      {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
    </select>
  );
  const refs = (refereesQ.data ?? []).map((r) => ({ id: r.id, label: r.full_name }));

  return (
    <Modal open={open} onClose={onClose} title="Ajuste con exposición de motivos" subtitle={`${match.home_name} vs ${match.away_name}`} size="lg" footer={
      <><button className="btn-ghost" onClick={onClose}>Cancelar</button>
        <button className="btn-gold" onClick={submit} disabled={busy || reason.trim().length < 10 || !Object.keys(changes).length}>{busy && <Spinner className="h-4 w-4" />}Registrar ajuste</button></>
    }>
      <Alert tone="warning">El registro anterior no se modifica ni se borra: queda como evidencia junto a este ajuste. Se notificará a los involucrados.</Alert>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div><label className="label">Cancha</label>{select("field", (fieldsQ.data ?? []).map((f) => ({ id: f.id, label: `${f.name} (cap. ${f.capacity})` })))}</div>
        <div><label className="label">Delegado</label>{select("delegate", (delegatesQ.data ?? []).map((d) => ({ id: d.id, label: d.full_name })))}</div>
        <div><label className="label">Inicio</label><DateTimeInput value={form.scheduled_start} onChange={(v) => setForm((f) => ({ ...f, scheduled_start: v }))} /></div>
        <div><label className="label">Fin</label><DateTimeInput value={form.scheduled_end} onChange={(v) => setForm((f) => ({ ...f, scheduled_end: v }))} /></div>
        <div><label className="label">Árbitro principal</label>{select("referee", refs)}</div>
        <div><label className="label">Asistente 1</label>{select("assistant_referee_1", refs)}</div>
        <div><label className="label">Asistente 2</label>{select("assistant_referee_2", refs)}</div>
      </div>
      <div className="mt-5">
        <label className="label">Exposición de motivos *</label>
        <textarea className="input min-h-[100px]" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Describa por qué se realiza el cambio (mínimo 10 caracteres)." />
      </div>
    </Modal>
  );
}
