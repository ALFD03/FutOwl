/**
 * Renderizador de la documentación (Markdown con extensiones de GitHub: tablas, listas de tareas,
 * tachado). No interpreta HTML embebido. Extensiones propias:
 *
 * - Avisos: `> [!NOTE]`, `> [!TIP]`, `> [!IMPORTANT]`, `> [!WARNING]`, `> [!CAUTION]`.
 * - Widgets dinámicos en bloques de código: ```futowl-roles```, ```futowl-permisos```, ```futowl-mis-permisos```.
 * - Enlaces internos (`/app/...`) se navegan sin recargar la página.
 */
import type { ReactNode } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { Link } from "react-router-dom";
import { AlertTriangle, Info, Lightbulb, Link2, ShieldAlert, Star } from "lucide-react";

import { cn } from "@/utils/cn";
import { slugify } from "@/utils/headings";

import { MyPermissionsWidget, PermissionCatalogWidget, RolesWidget } from "./PermissionWidgets";

export { headingsOf, slugify } from "@/utils/headings";

export const WIDGETS: Record<string, { label: string; render: () => ReactNode }> = {
  "futowl-roles": { label: "Roles vigentes y sus permisos", render: () => <RolesWidget /> },
  "futowl-permisos": { label: "Catálogo de permisos con buscador", render: () => <PermissionCatalogWidget /> },
  "futowl-mis-permisos": { label: "Roles y permisos del usuario que lee", render: () => <MyPermissionsWidget /> },
};

function textOf(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (node && typeof node === "object" && "props" in node) return textOf((node.props as { children?: ReactNode }).children);
  return "";
}

// ------------------------------------------------------------------ avisos (> [!NOTE])
interface MdNode {
  type: string;
  value?: string;
  children?: MdNode[];
  data?: Record<string, unknown>;
}

const CALLOUTS = {
  note: { title: "Nota", icon: Info, className: "border-navy-300 bg-navy-50 text-navy-900 dark:border-navy-500/40 dark:bg-navy-500/10 dark:text-navy-100" },
  tip: { title: "Consejo", icon: Lightbulb, className: "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-100" },
  important: { title: "Importante", icon: Star, className: "border-gold-400 bg-gold-50 text-gold-900 dark:border-gold-500/40 dark:bg-gold-500/10 dark:text-gold-100" },
  warning: { title: "Atención", icon: AlertTriangle, className: "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100" },
  caution: { title: "Cuidado", icon: ShieldAlert, className: "border-crimson-300 bg-crimson-50 text-crimson-900 dark:border-crimson-500/40 dark:bg-crimson-500/10 dark:text-crimson-100" },
} as const;
type CalloutKind = keyof typeof CALLOUTS;

/** Plugin remark: convierte `> [!TIPO]` en un aviso marcando el blockquote con `data-callout`. */
function remarkCallouts() {
  const walk = (node: MdNode) => {
    if (node.type === "blockquote") {
      const first = node.children?.[0];
      const text = first?.type === "paragraph" ? first.children?.[0] : undefined;
      const match = text?.type === "text" ? text.value?.match(/^\[!(note|tip|important|warning|caution)\][ \t]*\n?/i) : null;
      if (text && match) {
        text.value = text.value!.slice(match[0].length);
        node.data = { ...node.data, hProperties: { dataCallout: match[1].toLowerCase() } };
      }
    }
    node.children?.forEach(walk);
  };
  return (tree: MdNode) => walk(tree);
}

// ------------------------------------------------------------------ componentes
function heading(level: 1 | 2 | 3 | 4) {
  const Tag = `h${level}` as const;
  return function DocHeading({ children }: { children?: ReactNode }) {
    const id = slugify(textOf(children));
    return (
      <Tag id={id} className="group">
        {children}
        {level > 1 && (
          <a href={`#${id}`} aria-label="Enlace a esta sección" className="ml-2 inline-block align-middle opacity-0 transition group-hover:opacity-60">
            <Link2 className="h-4 w-4" />
          </a>
        )}
      </Tag>
    );
  };
}

const components: Components = {
  h1: heading(1),
  h2: heading(2),
  h3: heading(3),
  h4: heading(4),
  a({ href = "", children }) {
    if (href.startsWith("/")) return <Link to={href}>{children}</Link>;
    if (href.startsWith("#")) return <a href={href}>{children}</a>;
    return <a href={href} target="_blank" rel="noreferrer noopener">{children}</a>;
  },
  table({ children }) {
    return <div className="doc-table"><table>{children}</table></div>;
  },
  pre({ node, children }) {
    const code = node?.children[0];
    const classes = code && code.type === "element" ? code.properties.className : undefined;
    const language = Array.isArray(classes) ? String(classes.find((c) => String(c).startsWith("language-")) ?? "").slice(9) : "";
    const widget = WIDGETS[language];
    if (widget) return <div className="my-5 not-italic">{widget.render()}</div>;
    return <pre>{children}</pre>;
  },
  blockquote({ node, children }) {
    const kind = node?.properties?.dataCallout as CalloutKind | undefined;
    const callout = kind ? CALLOUTS[kind] : undefined;
    if (!callout) return <blockquote>{children}</blockquote>;
    const Icon = callout.icon;
    return (
      <div className={cn("my-5 rounded-xl border-l-4 px-4 py-3 text-sm [&>p:first-of-type]:mt-1 [&>p:last-child]:mb-0", callout.className)} role="note">
        <p className="mb-0 mt-0 flex items-center gap-2 font-bold"><Icon className="h-4 w-4" />{callout.title}</p>
        {children}
      </div>
    );
  },
};

export function DocMarkdown({ content, className }: { content: string; className?: string }) {
  return (
    <div className={cn("doc-content", className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm, remarkCallouts]} components={components}>{content}</ReactMarkdown>
    </div>
  );
}
