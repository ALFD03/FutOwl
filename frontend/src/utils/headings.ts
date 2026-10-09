/** Anclas e índice de títulos de la documentación en Markdown. */

/** Identificador de ancla a partir del texto de un título ("Mesa técnica" → "mesa-tecnica"). */
export function slugify(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

/** Quita la sintaxis Markdown en línea de un título (enlaces, negritas, código). */
function plain(text: string): string {
  return text.replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1").replace(/[*_`~]/g, "").trim();
}

export interface Heading {
  level: 2 | 3;
  text: string;
  id: string;
}

/** Títulos de nivel 2 y 3 (índice lateral de la página), ignorando los bloques de código. */
export function headingsOf(markdown: string): Heading[] {
  const headings: Heading[] = [];
  let fenced = false;
  for (const line of markdown.split("\n")) {
    if (/^\s*(```|~~~)/.test(line)) fenced = !fenced;
    if (fenced) continue;
    const match = line.match(/^(##|###)\s+(.+?)\s*#*\s*$/);
    if (match) {
      const text = plain(match[2]);
      headings.push({ level: match[1].length as 2 | 3, text, id: slugify(text) });
    }
  }
  return headings;
}
