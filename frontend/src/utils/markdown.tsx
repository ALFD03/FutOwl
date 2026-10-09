import type { ReactNode } from "react";

/** Renderizador Markdown mínimo y seguro (sin HTML embebido): títulos, listas, negritas y párrafos. */
function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? <strong key={i}>{part.slice(2, -2)}</strong> : part,
  );
}

export function Markdown({ content }: { content: string }) {
  const blocks: ReactNode[] = [];
  let list: string[] = [];
  const flush = () => {
    if (list.length) {
      blocks.push(<ul key={`l${blocks.length}`} className="my-3 list-disc space-y-1 pl-6">{list.map((li, i) => <li key={i}>{inline(li)}</li>)}</ul>);
      list = [];
    }
  };
  content.split("\n").forEach((raw) => {
    const line = raw.trim();
    if (/^[-*] /.test(line)) {
      list.push(line.slice(2));
      return;
    }
    flush();
    if (!line) return;
    const heading = line.match(/^(#{1,3})\s+(.*)$/);
    if (heading) {
      const level = heading[1].length;
      const cls = level === 1 ? "mt-2 text-2xl font-bold text-navy-900 dark:text-white" : level === 2 ? "mt-6 text-lg font-bold text-navy-900 dark:text-gold-400" : "mt-4 font-semibold";
      blocks.push(<p key={blocks.length} role="heading" aria-level={level} className={cls}>{inline(heading[2])}</p>);
    } else {
      blocks.push(<p key={blocks.length} className="my-2 leading-relaxed">{inline(line)}</p>);
    }
  });
  flush();
  return <div className="text-sm text-slate-700 dark:text-slate-300">{blocks}</div>;
}
