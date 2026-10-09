import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageSquarePlus } from "lucide-react";

import { api } from "@/api/client";
import { FileInput } from "@/components/forms";
import { Badge, Card, CardHeader, Spinner } from "@/components/ui";
import { useCan, useToast } from "@/hooks";
import { matches } from "@/services";
import type { Match } from "@/types";
import { formatDateTime } from "@/utils/datetime";
import { errorMessage } from "@/utils/errors";

/** Notas y apelaciones: único canal de cambios tras el cierre (pasan a revisión). */
export function NotesPanel({ match }: { match: Match }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const canAdd = useCan("competition.add_matchnote");
  const { data = [] } = useQuery({ queryKey: ["matches", match.id, "notes"], queryFn: () => matches.notes(match.id) });
  const [kind, setKind] = useState<"note" | "appeal">("note");
  const [body, setBody] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      const form = new FormData();
      form.append("kind", kind);
      form.append("body", body);
      if (file) form.append("attachment", file);
      await api.post(`/matches/${match.id}/add-note/`, form);
      toast.success(kind === "appeal" ? "Apelación registrada y enviada a revisión." : "Nota registrada.");
      setBody("");
      setFile(null);
      await queryClient.invalidateQueries({ queryKey: ["matches", match.id, "notes"] });
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
      <Card>
        <CardHeader title="Notas y apelaciones" subtitle="Registros permanentes" />
        <ul className="divide-y divide-slate-100 dark:divide-white/5">
          {data.map((n) => (
            <li key={n.id} className="px-5 py-4">
              <div className="mb-1 flex items-center gap-2 text-xs text-slate-500">
                <Badge tone={n.kind === "appeal" ? "crimson" : "slate"}>{n.kind_display}</Badge>{n.author_name} · {formatDateTime(n.created_at)}
              </div>
              <p className="whitespace-pre-line text-sm">{n.body}</p>
              {n.attachment && <a href={n.attachment} target="_blank" rel="noreferrer" className="mt-1 inline-block text-xs font-semibold text-navy-700 underline dark:text-gold-400">Adjunto</a>}
            </li>
          ))}
          {!data.length && <li className="px-5 py-10 text-center text-sm text-slate-400">Sin notas.</li>}
        </ul>
      </Card>
      {canAdd && (
        <Card className="h-fit">
          <CardHeader title="Nueva entrada" icon={<MessageSquarePlus className="h-5 w-5" />} />
          <div className="card-body space-y-4">
            <div className="grid grid-cols-2 gap-2">
              {(["note", "appeal"] as const).map((k) => (
                <button key={k} className={kind === k ? "btn-primary btn-sm" : "btn-outline btn-sm"} onClick={() => setKind(k)}>{k === "note" ? "Nota" : "Apelación"}</button>
              ))}
            </div>
            <textarea className="input min-h-[120px]" value={body} onChange={(e) => setBody(e.target.value)} placeholder={kind === "appeal" ? "Describa el caso extraordinario que apela" : "Escriba la nota"} />
            <FileInput value={file} onChange={setFile} accept="application/pdf,image/jpeg,image/png,.docx" />
            <button className="btn-gold w-full" disabled={busy || body.trim().length < 3} onClick={submit}>{busy && <Spinner className="h-4 w-4" />}Registrar</button>
          </div>
        </Card>
      )}
    </div>
  );
}
