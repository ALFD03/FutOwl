import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ShieldCheck } from "lucide-react";

import { Logo } from "@/components/layout/Logo";
import { Card, Spinner, Toggle } from "@/components/ui";
import { useAuth, useToast } from "@/hooks";
import { legal } from "@/services";
import { errorMessage } from "@/utils/errors";

import { TermsContent } from "./TermsPage";

export function AcceptTermsPage() {
  const { reload, logout } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);

  const accept = async () => {
    setBusy(true);
    try {
      await legal.accept();
      await reload();
      toast.success("Términos aceptados. ¡Bienvenido a FutOwl!");
      navigate("/app", { replace: true });
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <div className="mb-6 flex justify-center"><Logo /></div>
      <Card>
        <div className="card-header"><h1 className="flex items-center gap-2 text-lg font-bold"><ShieldCheck className="h-5 w-5 text-gold-500" /> Debe aceptar los términos para continuar</h1></div>
        <div className="max-h-[55vh] overflow-y-auto px-6 py-5"><TermsContent /></div>
        <div className="flex flex-col gap-4 border-t border-slate-100 px-6 py-4 sm:flex-row sm:items-center sm:justify-between dark:border-white/5">
          <label className="flex cursor-pointer items-start gap-3 text-sm">
            <span className="mt-0.5"><Toggle checked={checked} onChange={setChecked} label="Acepto los términos" /></span>
            He leído y acepto los términos y condiciones, y exonero al desarrollador de responsabilidad.
          </label>
          <div className="flex gap-2">
            <button className="btn-ghost" onClick={() => void logout()}>Salir</button>
            <button className="btn-gold" disabled={!checked || busy} onClick={accept}>{busy && <Spinner className="h-4 w-4" />}Acepto</button>
          </div>
        </div>
      </Card>
    </div>
  );
}
