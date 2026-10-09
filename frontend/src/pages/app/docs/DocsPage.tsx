/** Centro de ayuda: manual de usuario, preguntas frecuentes, roles y permisos (Markdown editable por el superusuario). */
import { useEffect, useMemo, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate, useOutletContext, useParams } from "react-router-dom";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, ArrowRight, BookOpen, ChevronDown, CircleHelp, Code2, EyeOff, FilePlus2, KeyRound, LifeBuoy, ListTree, Pencil, Search,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { DocMarkdown, headingsOf } from "@/components/docs/DocMarkdown";
import { Badge, Card, EmptyState, PageLoader, Spinner } from "@/components/ui";
import { useAuth, useDebounce, useToast } from "@/hooks";
import { docs } from "@/services";
import type { DocPageSummary, DocSection } from "@/types";
import { formatDateTime } from "@/utils/datetime";
import { cn } from "@/utils/cn";
import { errorMessage } from "@/utils/errors";

export const DOCS_BASE = "/app/ayuda";

export const SECTIONS: { id: DocSection; label: string; description: string; icon: LucideIcon }[] = [
  { id: "manual", label: "Manual de usuario", description: "Cómo usar cada parte de FutOwl, paso a paso y con ejemplos.", icon: BookOpen },
  { id: "faq", label: "Preguntas frecuentes", description: "Problemas comunes y cómo resolver casos puntuales.", icon: CircleHelp },
  { id: "permissions", label: "Roles y permisos", description: "Qué permite cada rol y cada permiso, y cómo asignarlos.", icon: KeyRound },
  { id: "reference", label: "Referencia técnica", description: "API, conexiones entre módulos y edición de esta documentación.", icon: Code2 },
];

export function sortPages(pages: DocPageSummary[]): DocPageSummary[] {
  const rank = (s: DocSection) => SECTIONS.findIndex((x) => x.id === s);
  return [...pages].sort((a, b) => rank(a.section) - rank(b.section) || a.order - b.order || a.title.localeCompare(b.title));
}

interface DocsContext {
  pages: DocPageSummary[];
}

export const useDocs = () => useOutletContext<DocsContext>();

// ------------------------------------------------------------------ Layout con índice lateral
function DocsIndex({ pages, onNavigate }: { pages: DocPageSummary[]; onNavigate?: () => void }) {
  const [query, setQuery] = useState("");
  const search = useDebounce(query.trim(), 300);
  const results = useQuery({
    queryKey: ["docs", "search", search], queryFn: () => docs.list({ search }), enabled: search.length >= 2, placeholderData: keepPreviousData,
  });
  const link = ({ isActive }: { isActive: boolean }) => cn(
    "flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm transition",
    isActive ? "bg-navy-900 font-semibold text-white dark:bg-gold-500 dark:text-navy-950" : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/5",
  );
  const item = (p: DocPageSummary) => (
    <li key={p.slug}>
      <NavLink to={`${DOCS_BASE}/${p.slug}`} className={link} onClick={onNavigate}>
        <span className="min-w-0 flex-1 truncate">{p.title}</span>
        {!p.is_active && <EyeOff className="h-3.5 w-3.5 shrink-0 opacity-60" aria-label="No publicada" />}
      </NavLink>
    </li>
  );
  return (
    <div className="space-y-5">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input className="input pl-9" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar en la ayuda…" aria-label="Buscar en la ayuda" />
      </div>
      {search.length >= 2 ? (
        <div>
          <p className="mb-1.5 flex items-center gap-2 px-2 text-[10px] font-bold uppercase tracking-[.2em] text-slate-400">
            Resultados {results.isFetching && <Spinner className="h-3 w-3" />}
          </p>
          <ul className="space-y-0.5">{sortPages(results.data ?? []).map(item)}</ul>
          {results.data?.length === 0 && <p className="px-2 text-sm text-slate-400">Sin resultados para «{search}».</p>}
        </div>
      ) : (
        <>
          <NavLink to={DOCS_BASE} end className={link} onClick={onNavigate}><LifeBuoy className="h-4 w-4" /> Inicio de la ayuda</NavLink>
          {SECTIONS.map((section) => {
            const items = pages.filter((p) => p.section === section.id);
            if (!items.length) return null;
            return (
              <div key={section.id}>
                <p className="mb-1.5 flex items-center gap-2 px-2 text-[10px] font-bold uppercase tracking-[.2em] text-gold-600 dark:text-gold-400/80">
                  <section.icon className="h-3.5 w-3.5" />{section.label}
                </p>
                <ul className="space-y-0.5">{items.map(item)}</ul>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}

export function DocsLayout() {
  const { data, isLoading } = useQuery({ queryKey: ["docs", "list"], queryFn: () => docs.list() });
  const [indexOpen, setIndexOpen] = useState(false);
  const location = useLocation();
  useEffect(() => setIndexOpen(false), [location.pathname]);
  const pages = useMemo(() => sortPages(data ?? []), [data]);
  if (isLoading) return <PageLoader label="Cargando la ayuda…" />;
  return (
    <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
      <aside className="lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto lg:pr-1">
        <Card className="lg:hidden">
          <button className="flex w-full items-center gap-2 px-4 py-3 text-sm font-semibold" onClick={() => setIndexOpen((o) => !o)} aria-expanded={indexOpen}>
            <ListTree className="h-4 w-4 text-gold-500" /> Índice de la ayuda
            <ChevronDown className={cn("ml-auto h-4 w-4 transition", indexOpen && "rotate-180")} />
          </button>
          {indexOpen && <div className="border-t border-slate-100 p-3 dark:border-white/5"><DocsIndex pages={pages} onNavigate={() => setIndexOpen(false)} /></div>}
        </Card>
        <div className="hidden lg:block"><DocsIndex pages={pages} /></div>
      </aside>
      <div className="min-w-0"><Outlet context={{ pages } satisfies DocsContext} /></div>
    </div>
  );
}

// ------------------------------------------------------------------ Portada
export function DocsHome() {
  const { pages } = useDocs();
  const { user } = useAuth();
  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-navy-950 via-navy-900 to-navy-700 p-6 text-white shadow-lift sm:p-8">
        <img src="/brand/isotipo.png" alt="" className="pointer-events-none absolute -right-6 -top-6 h-44 w-auto opacity-15" />
        <p className="flex items-center gap-2 text-sm font-semibold text-gold-300"><LifeBuoy className="h-4 w-4" /> Centro de ayuda</p>
        <h1 className="mt-1 text-2xl font-bold sm:text-3xl">Documentación de FutOwl</h1>
        <p className="mt-2 max-w-2xl text-slate-300">
          Manual de usuario completo, preguntas frecuentes con soluciones a casos puntuales y la guía de roles y permisos.
          Use el buscador del índice para encontrar cualquier tema.
        </p>
        {user?.is_superuser && (
          <Link to={`${DOCS_BASE}/nueva`} className="btn mt-5 border border-white/15 bg-white/5 text-white hover:bg-white/15"><FilePlus2 className="h-4 w-4 text-gold-400" /> Nueva página</Link>
        )}
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        {SECTIONS.map((section) => {
          const items = pages.filter((p) => p.section === section.id);
          if (!items.length) return null;
          return (
            <Card key={section.id}>
              <div className="card-header">
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-navy-50 text-navy-700 dark:bg-gold-500/10 dark:text-gold-400"><section.icon className="h-5 w-5" /></span>
                  <div>
                    <h2 className="font-bold text-slate-900 dark:text-white">{section.label}</h2>
                    <p className="text-xs text-slate-500">{section.description}</p>
                  </div>
                </div>
              </div>
              <ul className="divide-y divide-slate-100 dark:divide-white/5">
                {items.map((p) => (
                  <li key={p.slug}>
                    <Link to={`${DOCS_BASE}/${p.slug}`} className="group flex items-center gap-3 px-5 py-3 transition hover:bg-slate-50 dark:hover:bg-white/[.02]">
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2 text-sm font-semibold text-slate-800 group-hover:text-navy-700 dark:text-slate-100 dark:group-hover:text-gold-400">
                          {p.title}{!p.is_active && <Badge tone="amber">No publicada</Badge>}
                        </span>
                        {p.summary && <span className="block truncate text-xs text-slate-500">{p.summary}</span>}
                      </span>
                      <ArrowRight className="h-4 w-4 shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-gold-500" />
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          );
        })}
      </div>
      {!pages.length && <Card><EmptyState icon={<BookOpen className="h-7 w-7" />} title="Aún no hay páginas de ayuda" /></Card>}
    </div>
  );
}

// ------------------------------------------------------------------ Página
export function DocView() {
  const slug = useParams().slug!;
  const { pages } = useDocs();
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: page, isLoading, error } = useQuery({ queryKey: ["docs", "page", slug], queryFn: () => docs.get(slug), retry: false });
  const toc = useMemo(() => headingsOf(page?.content ?? ""), [page?.content]);
  const { hash } = useLocation();

  // Al abrir con #ancla, desplazarse cuando el contenido ya está renderizado.
  useEffect(() => {
    if (page && hash) document.getElementById(decodeURIComponent(hash.slice(1)))?.scrollIntoView();
    else if (page) window.scrollTo({ top: 0 });
  }, [page, hash]);

  if (isLoading) return <PageLoader />;
  if (error || !page) {
    return <Card><EmptyState icon={<BookOpen className="h-7 w-7" />} title="Página no encontrada" message={errorMessage(error, "La página no existe o no está publicada.")}
      action={<Link to={DOCS_BASE} className="btn-primary">Ir al inicio de la ayuda</Link>} /></Card>;
  }

  const index = pages.findIndex((p) => p.slug === slug);
  const prev = index > 0 ? pages[index - 1] : null;
  const next = index >= 0 && index < pages.length - 1 ? pages[index + 1] : null;
  const section = SECTIONS.find((s) => s.id === page.section);

  const togglePublished = async () => {
    try {
      await docs.update(slug, { is_active: !page.is_active });
      toast.success(page.is_active ? "Página despublicada: solo usted la ve." : "Página publicada para todos los usuarios.");
      await queryClient.invalidateQueries({ queryKey: ["docs"] });
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  return (
    <div className="grid gap-6 2xl:grid-cols-[minmax(0,1fr)_220px]">
      <article className="min-w-0">
        <Card>
          <header className="border-b border-slate-100 px-5 py-5 sm:px-8 dark:border-white/5">
            <p className="flex flex-wrap items-center gap-1 text-xs font-semibold text-slate-500">
              <Link to={DOCS_BASE} className="hover:underline">Ayuda</Link><span>›</span><span>{section?.label ?? page.section_display}</span>
            </p>
            <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{page.title}</h1>
                {page.summary && <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{page.summary}</p>}
              </div>
              {user?.is_superuser && (
                <div className="flex shrink-0 flex-wrap gap-2">
                  <button className="btn-ghost btn-sm" onClick={togglePublished}>{page.is_active ? "Despublicar" : "Publicar"}</button>
                  <button className="btn-primary btn-sm" onClick={() => navigate(`${DOCS_BASE}/${slug}/editar`)}><Pencil className="h-4 w-4" /> Editar</button>
                </div>
              )}
            </div>
            {!page.is_active && <Badge tone="amber" className="mt-3"><EyeOff className="h-3 w-3" /> No publicada: solo el superusuario la ve</Badge>}
          </header>
          <div className="px-5 py-6 sm:px-8"><DocMarkdown content={page.content} /></div>
          <footer className="border-t border-slate-100 px-5 py-3 text-xs text-slate-400 sm:px-8 dark:border-white/5">
            Última actualización: {formatDateTime(page.updated_at)}{page.updated_by_name && ` · ${page.updated_by_name}`}
          </footer>
        </Card>
        <nav className="mt-4 grid gap-3 sm:grid-cols-2" aria-label="Páginas contiguas">
          {prev ? (
            <Link to={`${DOCS_BASE}/${prev.slug}`} className="card card-hover flex items-center gap-3 p-4">
              <ArrowLeft className="h-4 w-4 text-gold-500" />
              <span className="min-w-0"><span className="block text-xs text-slate-500">Anterior</span><b className="block truncate text-sm">{prev.title}</b></span>
            </Link>
          ) : <span />}
          {next && (
            <Link to={`${DOCS_BASE}/${next.slug}`} className="card card-hover flex items-center justify-end gap-3 p-4 text-right">
              <span className="min-w-0"><span className="block text-xs text-slate-500">Siguiente</span><b className="block truncate text-sm">{next.title}</b></span>
              <ArrowRight className="h-4 w-4 text-gold-500" />
            </Link>
          )}
        </nav>
      </article>
      {toc.length > 2 && (
        <aside className="hidden 2xl:block">
          <div className="sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-[.2em] text-slate-400">En esta página</p>
            <ul className="space-y-1 border-l border-slate-200 text-sm dark:border-white/10">
              {toc.map((h) => (
                <li key={h.id}>
                  <a href={`#${h.id}`} className={cn("-ml-px block border-l-2 border-transparent py-0.5 text-slate-500 hover:border-gold-400 hover:text-navy-800 dark:hover:text-white",
                    h.level === 3 ? "pl-6 text-xs" : "pl-3")}>{h.text}</a>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      )}
    </div>
  );
}
