/** Editor Markdown de la documentación (exclusivo del superusuario), con vista previa e historial. */
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, Bold, Code2, Columns2, Eye, Heading2, Heading3, History, Info, Italic, Link2, List, ListOrdered, PencilLine,
  RotateCcw, Save, ShieldAlert, Table2,
} from "lucide-react";

import { DocMarkdown, slugify, WIDGETS } from "@/components/docs/DocMarkdown";
import { Alert, Card, EmptyState, Modal, PageLoader, Segmented, SelectMenu, Spinner, Toggle } from "@/components/ui";
import { useAuth, useToast } from "@/hooks";
import { docs } from "@/services";
import type { DocPage, DocRevision, DocSection } from "@/types";
import { cn } from "@/utils/cn";
import { formatDateTime } from "@/utils/datetime";
import { errorMessage, fieldErrors } from "@/utils/errors";

import { DOCS_BASE, SECTIONS } from "./DocsPage";

type Draft = Pick<DocPage, "slug" | "title" | "summary" | "section" | "order" | "content" | "is_active">;
type View = "write" | "split" | "preview";

const EMPTY: Draft = { slug: "", title: "", summary: "", section: "manual", order: 100, content: "", is_active: true };

/** Fragmentos que la barra de herramientas inserta (o aplica a la selección con `$`). */
const SNIPPETS: { label: string; icon: typeof Bold; before: string; after?: string; block?: boolean }[] = [
  { label: "Título de sección", icon: Heading2, before: "## ", block: true },
  { label: "Subtítulo", icon: Heading3, before: "### ", block: true },
  { label: "Negrita", icon: Bold, before: "**", after: "**" },
  { label: "Cursiva", icon: Italic, before: "_", after: "_" },
  { label: "Lista", icon: List, before: "- ", block: true },
  { label: "Lista numerada", icon: ListOrdered, before: "1. ", block: true },
  { label: "Enlace", icon: Link2, before: "[", after: "](/app/ayuda/primeros-pasos)" },
  { label: "Código", icon: Code2, before: "`", after: "`" },
  { label: "Tabla", icon: Table2, before: "| Columna | Descripción |\n|---------|-------------|\n| Dato    | Explicación |\n", block: true },
  { label: "Aviso", icon: Info, before: "> [!TIP]\n> ", block: true },
];

export function DocEditor() {
  const slug = useParams().slug;
  const creating = !slug;
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const textarea = useRef<HTMLTextAreaElement>(null);
  const { data: page, isLoading } = useQuery({ queryKey: ["docs", "page", slug], queryFn: () => docs.get(slug!), enabled: !creating });
  const [draft, setDraft] = useState<Draft | null>(creating ? EMPTY : null);
  const [slugTouched, setSlugTouched] = useState(false);
  const [view, setView] = useState<View>("split");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState(false);

  useEffect(() => {
    if (page && !draft) setDraft({ slug: page.slug, title: page.title, summary: page.summary, section: page.section, order: page.order, content: page.content, is_active: page.is_active });
  }, [page, draft]);

  if (!user?.is_superuser) {
    return <Card><EmptyState icon={<ShieldAlert className="h-7 w-7" />} title="Acceso restringido" message="Solo el superadministrador puede editar la documentación." /></Card>;
  }
  if (isLoading || !draft) return <PageLoader />;

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => ({ ...d!, [key]: value }));
  const dirty = creating ? Boolean(draft.title || draft.content) : !page || (Object.keys(draft) as (keyof Draft)[]).some((k) => draft[k] !== page[k]);

  const insert = (snippet: (typeof SNIPPETS)[number] | { before: string; after?: string; block?: boolean }) => {
    const el = textarea.current;
    if (!el) return;
    const { selectionStart: start, selectionEnd: end, value } = el;
    const selected = value.slice(start, end);
    const prefix = snippet.block && start > 0 && value[start - 1] !== "\n" ? "\n" : "";
    const text = `${prefix}${snippet.before}${selected}${snippet.after ?? ""}`;
    set("content", value.slice(0, start) + text + value.slice(end));
    requestAnimationFrame(() => {
      el.focus();
      const cursor = start + prefix.length + snippet.before.length + selected.length;
      el.setSelectionRange(cursor, cursor);
    });
  };

  const save = async () => {
    setBusy(true);
    setErrors({});
    try {
      const saved = creating ? await docs.create(draft) : await docs.update(slug!, { ...draft, slug: undefined });
      toast.success(creating ? "Página creada." : "Cambios guardados. La versión anterior quedó en el historial.");
      await queryClient.invalidateQueries({ queryKey: ["docs"] });
      navigate(`${DOCS_BASE}/${saved.slug}`);
    } catch (e) {
      setErrors(fieldErrors(e));
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const cancel = () => {
    if (dirty && !window.confirm("Hay cambios sin guardar. ¿Descartarlos?")) return;
    navigate(creating ? DOCS_BASE : `${DOCS_BASE}/${slug}`);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <button className="btn-ghost -ml-3" onClick={cancel}><ArrowLeft className="h-4 w-4" /> {creating ? "Ayuda" : "Volver a la página"}</button>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {!creating && <button className="btn-outline" onClick={() => setHistory(true)}><History className="h-4 w-4" /> Historial</button>}
          <button className="btn-gold" onClick={save} disabled={busy || !draft.title.trim() || (creating && !draft.slug)}>
            {busy ? <Spinner className="h-4 w-4" /> : <Save className="h-4 w-4" />}{creating ? "Crear página" : "Guardar cambios"}
          </button>
        </div>
      </div>

      <Card>
        <div className="grid gap-4 p-5 md:grid-cols-2 2xl:grid-cols-4">
          <div className="md:col-span-2">
            <label className="label" htmlFor="doc-title">Título *</label>
            <input id="doc-title" className={cn("input", errors.title && "input-error")} value={draft.title} onChange={(e) => {
              set("title", e.target.value);
              if (creating && !slugTouched) set("slug", slugify(e.target.value));
            }} />
            {errors.title && <p className="error-text">{errors.title}</p>}
          </div>
          <div>
            <label className="label" htmlFor="doc-slug">Identificador (URL) *</label>
            <input id="doc-slug" className={cn("input font-mono text-xs", errors.slug && "input-error")} value={draft.slug} disabled={!creating}
              onChange={(e) => { setSlugTouched(true); set("slug", e.target.value); }} />
            <p className="help">{creating ? `${DOCS_BASE}/${draft.slug || "…"}` : "No se cambia para no romper enlaces."}</p>
            {errors.slug && <p className="error-text">{errors.slug}</p>}
          </div>
          <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_88px] gap-3">
            <div>
              <label className="label">Sección</label>
              <SelectMenu value={draft.section} onChange={(v) => set("section", v as DocSection)} options={SECTIONS.map((s) => ({ value: s.id, label: s.label }))} />
            </div>
            <div>
              <label className="label" htmlFor="doc-order">Orden</label>
              <input id="doc-order" type="number" min={0} className="input" value={draft.order} onChange={(e) => set("order", Number(e.target.value))} />
            </div>
          </div>
          <div className="md:col-span-2 2xl:col-span-3">
            <label className="label" htmlFor="doc-summary">Resumen</label>
            <input id="doc-summary" className="input" value={draft.summary} maxLength={255} onChange={(e) => set("summary", e.target.value)} placeholder="Una línea que describa la página" />
          </div>
          <label className="flex cursor-pointer items-center gap-2 self-end pb-2 text-sm font-semibold md:col-span-2 2xl:col-span-1">
            <Toggle checked={draft.is_active} onChange={(v) => set("is_active", v)} label="Publicada" /> Publicada para todos
          </label>
        </div>
      </Card>

      <Card>
        <div className="flex flex-wrap items-center gap-1 border-b border-slate-100 px-3 py-2 dark:border-white/5">
          {SNIPPETS.map((s) => (
            <button key={s.label} type="button" className="btn-ghost h-8 w-8 p-0" title={s.label} aria-label={s.label} onClick={() => insert(s)} disabled={view === "preview"}>
              <s.icon className="h-4 w-4" />
            </button>
          ))}
          <WidgetMenu disabled={view === "preview"} onPick={(lang) => insert({ before: `\`\`\`${lang}\n\`\`\`\n`, block: true })} />
          <div className="ml-auto">
            <Segmented<View> value={view} onChange={setView} options={[
              { value: "write", label: "Escribir", icon: <PencilLine className="h-3.5 w-3.5" /> },
              { value: "split", label: "Dividido", icon: <Columns2 className="h-3.5 w-3.5" /> },
              { value: "preview", label: "Vista previa", icon: <Eye className="h-3.5 w-3.5" /> },
            ]} />
          </div>
        </div>
        <div className={cn("grid", view === "split" && "xl:grid-cols-2")}>
          {view !== "preview" && (
            <textarea ref={textarea} value={draft.content} onChange={(e) => set("content", e.target.value)} spellCheck
              className={cn("min-h-[65vh] w-full resize-y border-0 bg-transparent p-5 font-mono text-[13px] leading-relaxed text-slate-800 focus:outline-none focus:ring-0 dark:text-slate-200",
                view === "split" && "xl:border-r xl:border-slate-100 xl:dark:border-white/5")}
              placeholder={"## Título de sección\n\nEscriba el contenido en Markdown…"} aria-label="Contenido en Markdown" />
          )}
          {view !== "write" && (
            <div className={cn("min-w-0 p-5 sm:px-8", view === "split" && "hidden max-h-[75vh] overflow-y-auto xl:block")}>
              {draft.content.trim() ? <DocMarkdown content={draft.content} /> : <p className="text-sm text-slate-400">La vista previa aparecerá aquí.</p>}
            </div>
          )}
        </div>
        <p className="border-t border-slate-100 px-5 py-2 text-xs text-slate-400 dark:border-white/5">
          Markdown con tablas, listas de tareas y avisos (<code>&gt; [!NOTE]</code>, <code>[!TIP]</code>, <code>[!WARNING]</code>…). Guía completa en{" "}
          <Link to={`${DOCS_BASE}/editar-documentacion`} className="font-semibold underline" target="_blank">Cómo editar la documentación</Link>.
        </p>
      </Card>

      {!creating && history && (
        <HistoryModal slug={slug!} onClose={() => setHistory(false)} onRestore={(rev) => {
          setDraft((d) => ({ ...d!, title: rev.title, content: rev.content }));
          setHistory(false);
          toast.info("Versión cargada en el editor. Guarde para restaurarla.");
        }} />
      )}
    </div>
  );
}

function WidgetMenu({ onPick, disabled }: { onPick: (lang: string) => void; disabled?: boolean }) {
  return (
    <div className="w-48">
      <SelectMenu value={null} disabled={disabled} placeholder="Insertar widget…" className="py-1 text-xs" onChange={(v) => v != null && onPick(String(v))}
        options={Object.entries(WIDGETS).map(([lang, w]) => ({ value: lang, label: w.label, hint: lang }))} />
    </div>
  );
}

function HistoryModal({ slug, onClose, onRestore }: { slug: string; onClose: () => void; onRestore: (rev: DocRevision) => void }) {
  const { data, isLoading } = useQuery({ queryKey: ["docs", "revisions", slug], queryFn: () => docs.revisions(slug) });
  const [selected, setSelected] = useState<DocRevision | null>(null);
  const shown = selected ?? data?.[0] ?? null;
  return (
    <Modal open onClose={onClose} title="Historial de versiones" subtitle="Cada guardado conserva una copia inalterable" size="xl" footer={
      <><button className="btn-ghost" onClick={onClose}>Cerrar</button>
        <button className="btn-primary" disabled={!shown} onClick={() => shown && onRestore(shown)}><RotateCcw className="h-4 w-4" /> Cargar esta versión en el editor</button></>
    }>
      {isLoading ? <Spinner /> : !data?.length ? <Alert tone="info">Sin versiones registradas.</Alert> : (
        <div className="grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)]">
          <ul className="max-h-[60vh] space-y-1 overflow-y-auto">
            {data.map((rev, i) => (
              <li key={rev.id}>
                <button onClick={() => setSelected(rev)} className={cn("w-full rounded-xl px-3 py-2 text-left text-sm transition",
                  shown?.id === rev.id ? "bg-navy-900 text-white dark:bg-gold-500 dark:text-navy-950" : "hover:bg-slate-100 dark:hover:bg-white/5")}>
                  <b className="block">{formatDateTime(rev.created_at)}{i === 0 && " · actual"}</b>
                  <span className="text-xs opacity-75">{rev.edited_by_name} · {rev.content.length.toLocaleString("es-VE")} caracteres</span>
                </button>
              </li>
            ))}
          </ul>
          <div className="max-h-[60vh] min-w-0 overflow-y-auto rounded-xl border border-slate-100 p-4 dark:border-white/5">
            {shown && <><h2 className="mb-3 text-lg font-bold">{shown.title}</h2><DocMarkdown content={shown.content} /></>}
          </div>
        </div>
      )}
    </Modal>
  );
}
