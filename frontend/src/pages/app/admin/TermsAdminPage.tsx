import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText, Send } from "lucide-react";

import { Alert, Card, CardHeader, PageHeader, Spinner } from "@/components/ui";
import { useToast } from "@/hooks";
import { legal } from "@/services";
import { errorMessage } from "@/utils/errors";
import { Markdown } from "@/utils/markdown";

export function TermsAdminPage() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const { data } = useQuery({ queryKey: ["terms"], queryFn: legal.current });
  const [form, setForm] = useState<{ version: string; title: string; content: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const draft = form ?? { version: "", title: data?.title ?? "Términos y Condiciones de Uso de FutOwl", content: data?.content ?? "" };

  const publish = async () => {
    setBusy(true);
    try {
      await legal.publish(draft);
      toast.success("Nueva versión publicada. Todos los usuarios deberán aceptarla.");
      setForm(null);
      await queryClient.invalidateQueries({ queryKey: ["terms"] });
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageHeader title="Términos y condiciones" subtitle={data ? `Versión vigente: ${data.version}` : undefined} icon={<FileText className="h-6 w-6" />} />
      <Alert tone="info">Las versiones no se editan: se publica una nueva y los usuarios deben aceptarla para seguir usando la aplicación.</Alert>
      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader title="Nueva versión" actions={<button className="btn-gold btn-sm" disabled={busy || !draft.version || draft.content.length < 50} onClick={publish}>{busy ? <Spinner className="h-4 w-4" /> : <Send className="h-4 w-4" />}Publicar</button>} />
          <div className="card-body space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div><label className="label">Versión</label><input className="input" value={draft.version} placeholder="1.1" onChange={(e) => setForm({ ...draft, version: e.target.value })} /></div>
              <div><label className="label">Título</label><input className="input" value={draft.title} onChange={(e) => setForm({ ...draft, title: e.target.value })} /></div>
            </div>
            <textarea className="input min-h-[480px] font-mono text-xs" value={draft.content} onChange={(e) => setForm({ ...draft, content: e.target.value })} />
          </div>
        </Card>
        <Card><CardHeader title="Vista previa" /><div className="card-body max-h-[620px] overflow-y-auto"><Markdown content={draft.content} /></div></Card>
      </div>
    </div>
  );
}
