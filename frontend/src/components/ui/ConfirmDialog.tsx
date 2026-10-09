import { useState, type ReactNode } from "react";

import { Modal } from "./Modal";
import { Spinner } from "./Spinner";

/**
 * Diálogo de confirmación. Si `requireReason` está activo, exige una exposición de motivos.
 */
export function ConfirmDialog({ open, onClose, onConfirm, title, message, confirmLabel = "Confirmar", danger, requireReason, reasonLabel = "Exposición de motivos", minReason = 10 }: {
  open: boolean; onClose: () => void; onConfirm: (reason: string) => Promise<unknown> | void; title: string;
  message?: ReactNode; confirmLabel?: string; danger?: boolean; requireReason?: boolean; reasonLabel?: string; minReason?: number;
}) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const invalid = requireReason && reason.trim().length < minReason;

  const submit = async () => {
    setBusy(true);
    try {
      await onConfirm(reason.trim());
      setReason("");
      onClose();
    } catch {
      /* el error se notifica en la acción */
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={title} size="sm" footer={
      <>
        <button className="btn-ghost" onClick={onClose} disabled={busy}>Cancelar</button>
        <button className={danger ? "btn-danger" : "btn-primary"} onClick={submit} disabled={busy || invalid}>
          {busy && <Spinner className="h-4 w-4" />} {confirmLabel}
        </button>
      </>
    }>
      {message && <div className="text-sm text-slate-600 dark:text-slate-300">{message}</div>}
      {requireReason && (
        <div className="mt-4">
          <label className="label" htmlFor="reason">{reasonLabel}</label>
          <textarea id="reason" className="input min-h-[96px]" value={reason} onChange={(e) => setReason(e.target.value)}
            placeholder="Explique el motivo. Quedará registrado de forma permanente." />
          <p className="help">Mínimo {minReason} caracteres. El registro anterior no se borra: queda la evidencia del cambio.</p>
        </div>
      )}
    </Modal>
  );
}
