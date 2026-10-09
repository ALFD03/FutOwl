import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, FileDown, FileText, Save } from "lucide-react";

import { downloadFile } from "@/api/client";
import { Card, CardHeader, SelectMenu, Spinner } from "@/components/ui";
import { useCan, useToast } from "@/hooks";
import { registrations, tournaments } from "@/services";
import type { Tournament } from "@/types";
import { errorMessage } from "@/utils/errors";

const DOCS = [
  { key: "lineup-sheet", label: "Planilla de alineación", help: "Generada con la nómina del equipo. Se puede llenar e importar.", file: "lineup_sheet_file" },
  { key: "substitution-cards", label: "Tarjetas de cambio", help: "Tarjetas imprimibles para la mesa técnica.", file: "substitution_card_file" },
  { key: "regulation", label: "Reglamento", help: "Generado a partir del texto del reglamento.", file: "regulation_file" },
] as const;

export function DocumentsTab({ tournament }: { tournament: Tournament }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const canEdit = useCan("tournaments.change_tournament");
  const regs = useQuery({ queryKey: ["registrations", tournament.id], queryFn: () => registrations.all({ tournament: tournament.id, is_active: true }) });
  const [reg, setReg] = useState<number | "">("");
  const [busy, setBusy] = useState<string | null>(null);
  const [text, setText] = useState(tournament.regulation_text);
  const selected = regs.data?.find((r) => r.id === reg);

  const download = async (key: string, format: "pdf" | "docx") => {
    if (key !== "regulation" && !selected) return toast.warning("Seleccione un equipo inscrito.");
    setBusy(`${key}-${format}`);
    try {
      await downloadFile(`/tournaments/${tournament.id}/documents/${key}/`,
        { format_type: format, team: selected?.team, category: selected?.category }, `${key}.${format}`);
    } catch (e) {
      toast.error(errorMessage(e, "No se pudo generar el documento."));
    } finally {
      setBusy(null);
    }
  };

  const saveRegulation = async () => {
    setBusy("regulation-text");
    try {
      await tournaments.update(tournament.id, { regulation_text: text });
      toast.success("Reglamento guardado.");
      await queryClient.invalidateQueries({ queryKey: ["tournaments"] });
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <Card>
        <CardHeader title="Exportar documentos" subtitle="PDF o Word, generados con los datos del torneo" icon={<FileDown className="h-5 w-5" />} />
        <div className="card-body space-y-5">
          <div>
            <label className="label">Equipo / categoría</label>
            <SelectMenu value={reg === "" ? null : reg} onChange={(v) => setReg(v == null ? "" : Number(v))} placeholder="Seleccione el equipo…"
              options={(regs.data ?? []).map((r) => ({ value: r.id, label: `${r.team_name} · ${r.category_name}` }))} />
          </div>
          {DOCS.map((doc) => {
            const imported = tournament[doc.file];
            return (
              <div key={doc.key} className="flex flex-col gap-3 rounded-xl border border-slate-100 p-4 sm:flex-row sm:items-center dark:border-white/5">
                <FileText className="h-8 w-8 shrink-0 text-gold-500" />
                <div className="flex-1">
                  <p className="font-semibold">{doc.label}</p>
                  <p className="text-xs text-slate-500">{doc.help}</p>
                  {imported && <a href={imported} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-navy-700 underline dark:text-gold-400"><Download className="h-3 w-3" /> Plantilla importada</a>}
                </div>
                <div className="flex gap-2">
                  {(["pdf", "docx"] as const).map((f) => (
                    <button key={f} className="btn-outline btn-sm" onClick={() => download(doc.key, f)} disabled={busy !== null}>
                      {busy === `${doc.key}-${f}` ? <Spinner className="h-3 w-3" /> : <Download className="h-3.5 w-3.5" />}{f.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
          <p className="text-xs text-slate-500">Para importar plantillas propias (Word/PDF) use “Editar” en el encabezado del torneo.</p>
        </div>
      </Card>
      <Card>
        <CardHeader title="Reglamento (texto)" subtitle="Admite títulos con # y listas con -" icon={<FileText className="h-5 w-5" />}
          actions={canEdit && <button className="btn-primary btn-sm" onClick={saveRegulation} disabled={busy !== null}><Save className="h-4 w-4" /> Guardar</button>} />
        <div className="card-body">
          <textarea className="input min-h-[420px] font-mono text-xs" value={text} onChange={(e) => setText(e.target.value)} disabled={!canEdit}
            placeholder={"# Capítulo I\n- Artículo 1. …"} />
        </div>
      </Card>
    </div>
  );
}
