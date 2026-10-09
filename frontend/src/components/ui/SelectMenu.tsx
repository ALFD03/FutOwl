import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Loader2, Search, X } from "lucide-react";

import { cn } from "@/utils/cn";

import { useAnchoredPanel } from "./useAnchoredPanel";

export type OptionValue = string | number;

export interface SelectOption {
  value: OptionValue;
  label: string;
  /** Segunda línea en la lista (p. ej. cédula o equipo). */
  hint?: string;
  disabled?: boolean;
}

/** A partir de cuántas opciones aparece el buscador si no se indica. */
const SEARCH_THRESHOLD = 7;

/** Minúsculas y sin tildes: «guacara» encuentra «Guácara». */
export const normalize = (text: string) => text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

function Highlight({ text, query }: { text: string; query: string }): ReactNode {
  const q = normalize(query.trim());
  const base = normalize(text);
  const start = q ? base.indexOf(q) : -1;
  if (start < 0 || base.length !== text.length) return text;
  return (
    <>
      {text.slice(0, start)}
      <span className="rounded bg-gold-200/70 text-navy-950 dark:bg-gold-500/30 dark:text-gold-200">{text.slice(start, start + q.length)}</span>
      {text.slice(start + q.length)}
    </>
  );
}

export interface SelectMenuProps {
  value: OptionValue | null | undefined;
  onChange: (value: OptionValue | null, option?: SelectOption) => void;
  /** Opciones fijas. Con `load`, se piden al servidor según lo que se escribe. */
  options?: SelectOption[];
  load?: (query: string) => Promise<SelectOption[]>;
  /** Etiqueta a mostrar cuando el valor no está entre las opciones cargadas (búsqueda remota). */
  selectedLabel?: string;
  placeholder?: string;
  searchPlaceholder?: string;
  searchable?: boolean;
  clearable?: boolean;
  disabled?: boolean;
  invalid?: boolean;
  className?: string;
  panelWidth?: number;
  id?: string;
  "aria-label"?: string;
}

/**
 * Desplegable de una sola selección, propio (no el `<select>` del navegador): se ve igual en
 * claro/oscuro, permite buscar sin distinguir tildes, resalta la coincidencia y se maneja con
 * teclado (flechas, Enter, Escape). Con `load` busca en el servidor (p. ej. por nombre o cédula).
 */
export function SelectMenu({
  value, onChange, options = [], load, selectedLabel, placeholder = "Seleccione…", searchPlaceholder,
  searchable, clearable, disabled, invalid, className, panelWidth, id, ...rest
}: SelectMenuProps) {
  const remote = Boolean(load);
  const withSearch = remote || (searchable ?? options.length >= SEARCH_THRESHOLD);
  const { isOpen, coords, triggerRef, panelRef, open, close } = useAnchoredPanel<HTMLButtonElement>({ width: panelWidth, estimatedHeight: 340 });
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [remoteOptions, setRemoteOptions] = useState<SelectOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [known, setKnown] = useState<SelectOption | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const loadRef = useRef(load);
  loadRef.current = load;

  // Búsqueda remota con una pequeña espera para no consultar en cada tecla.
  useEffect(() => {
    if (!remote || !isOpen) return;
    let alive = true;
    setLoading(true);
    const timer = setTimeout(() => {
      loadRef.current!(query.trim())
        .then((rows) => alive && setRemoteOptions(rows))
        .catch(() => alive && setRemoteOptions([]))
        .finally(() => alive && setLoading(false));
    }, 250);
    return () => { alive = false; clearTimeout(timer); };
  }, [remote, isOpen, query]);

  const source = remote ? remoteOptions : options;
  const filtered = useMemo(() => {
    if (remote || !withSearch || !query.trim()) return source;
    const q = normalize(query.trim());
    return source.filter((o) => normalize(`${o.label} ${o.hint ?? ""}`).includes(q));
  }, [source, query, remote, withSearch]);

  const selected = options.find((o) => o.value === value) ?? remoteOptions.find((o) => o.value === value)
    ?? (known?.value === value ? known : null);
  const display = selected?.label ?? (value != null && value !== "" ? selectedLabel : undefined);

  const openWith = (initial = "") => {
    setQuery(initial);
    setActive(initial ? 0 : Math.max(0, filtered.findIndex((o) => o.value === value)));
    open();
  };
  const closeMenu = (focus = false) => {
    close();
    if (focus) triggerRef.current?.focus();
  };
  const choose = (option?: SelectOption) => {
    if (!option || option.disabled) return;
    setKnown(option);
    onChange(option.value, option);
    closeMenu(true);
  };
  const move = (index: number) => {
    if (!filtered.length) return;
    const next = (index + filtered.length) % filtered.length;
    setActive(next);
    listRef.current?.querySelector<HTMLElement>(`[data-index="${next}"]`)?.scrollIntoView({ block: "nearest" });
  };
  const onListKey = (e: KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); move(active + 1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); move(active - 1); }
    else if (e.key === "Enter") { e.preventDefault(); choose(filtered[active]); }
    else if (e.key === "Tab") closeMenu();
  };
  const onTriggerKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (disabled || isOpen) return;
    const printable = e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey && e.key !== " ";
    if (withSearch && printable) { e.preventDefault(); openWith(e.key); }
    else if (e.key === "ArrowDown") { e.preventDefault(); openWith(); }
  };

  return (
    <>
      <button ref={triggerRef} id={id} type="button" disabled={disabled} aria-haspopup="listbox" aria-expanded={isOpen}
        aria-label={rest["aria-label"]} onKeyDown={onTriggerKey}
        onClick={() => !disabled && (isOpen ? closeMenu() : openWith())}
        className={cn("input flex items-center justify-between gap-2 text-left", isOpen && "border-navy-500 ring-2 ring-navy-500/20 dark:border-gold-500 dark:ring-gold-500/20",
          invalid && "input-error", disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer", className)}>
        <span className={cn("truncate", !display && "text-slate-400")}>{display ?? placeholder}</span>
        <span className="flex shrink-0 items-center gap-1">
          {clearable && value != null && value !== "" && !disabled && (
            <span role="button" tabIndex={-1} aria-label="Quitar selección" className="rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-crimson-600 dark:hover:bg-white/10"
              onClick={(e) => { e.stopPropagation(); onChange(null); }}>
              <X className="h-3.5 w-3.5" />
            </span>
          )}
          <ChevronDown className={cn("h-4 w-4 text-slate-400 transition-transform duration-200", isOpen && "rotate-180")} />
        </span>
      </button>

      {isOpen && coords && createPortal(
        <div ref={panelRef} style={{ top: coords.top, left: coords.left, width: coords.width }}
          className="fixed z-[100] flex max-h-[340px] animate-scale-in flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lift dark:border-white/10 dark:bg-ink-800">
          {withSearch && (
            <div className="border-b border-slate-100 p-1.5 dark:border-white/5">
              <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5 focus-within:border-navy-400 dark:border-white/10 dark:bg-ink-900/60 dark:focus-within:border-gold-500">
                {loading ? <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-slate-400" /> : <Search className="h-3.5 w-3.5 shrink-0 text-slate-400" />}
                <input autoFocus value={query} onKeyDown={onListKey} placeholder={searchPlaceholder ?? (remote ? "Escriba para buscar…" : "Buscar…")}
                  onChange={(e) => { setQuery(e.target.value); setActive(0); }}
                  className="w-full bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400 dark:text-slate-100" />
                {query && !remote && <span className="shrink-0 text-[10px] font-bold text-slate-400">{filtered.length}/{source.length}</span>}
              </div>
            </div>
          )}
          <div ref={listRef} role="listbox" className="overflow-y-auto p-1.5" onKeyDown={withSearch ? undefined : onListKey} tabIndex={withSearch ? undefined : -1}>
            {!loading && filtered.length === 0 && (
              <p className="px-3 py-2 text-xs text-slate-400">
                {query.trim() ? `Sin coincidencias para «${query.trim()}»` : remote ? "No hay registros disponibles" : "Sin opciones"}
              </p>
            )}
            {filtered.map((option, index) => {
              const isSelected = option.value === value;
              const isActive = index === active;
              return (
                <button key={option.value} type="button" role="option" aria-selected={isSelected} data-index={index} disabled={option.disabled}
                  onMouseEnter={() => setActive(index)} onClick={() => choose(option)}
                  className={cn("flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-40",
                    isSelected ? "bg-navy-900 font-semibold text-white dark:bg-gold-500 dark:text-navy-950"
                      : isActive ? "bg-slate-100 text-slate-900 dark:bg-white/[.07] dark:text-white" : "text-slate-700 dark:text-slate-300")}>
                  <span className="min-w-0">
                    <span className="block truncate"><Highlight text={option.label} query={remote ? "" : query} /></span>
                    {option.hint && <span className={cn("block truncate text-xs", isSelected ? "opacity-80" : "text-slate-400")}>{option.hint}</span>}
                  </span>
                  {isSelected && <Check className="h-4 w-4 shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}

/** Selección múltiple en desplegable: lo elegido queda como fichas que se quitan con un clic. */
export function MultiSelectMenu({ value, onChange, options, placeholder = "Seleccione…", disabled, invalid }: {
  value: OptionValue[]; onChange: (value: OptionValue[]) => void; options: SelectOption[]; placeholder?: string;
  disabled?: boolean; invalid?: boolean;
}) {
  const { isOpen, coords, triggerRef, panelRef, open, close } = useAnchoredPanel<HTMLDivElement>({ estimatedHeight: 360 });
  const [query, setQuery] = useState("");
  const chosen = new Set(value);
  const toggle = (v: OptionValue) => onChange(chosen.has(v) ? value.filter((x) => x !== v) : [...value, v]);
  const visible = options.filter((o) => normalize(`${o.label} ${o.hint ?? ""}`).includes(normalize(query.trim())));
  const selectedOptions = options.filter((o) => chosen.has(o.value));

  return (
    <>
      <div ref={triggerRef} role="button" tabIndex={disabled ? -1 : 0} aria-haspopup="listbox" aria-expanded={isOpen}
        onClick={() => !disabled && (isOpen ? close() : (setQuery(""), open()))}
        onKeyDown={(e) => { if (!disabled && (e.key === "Enter" || e.key === "ArrowDown")) { e.preventDefault(); setQuery(""); open(); } }}
        className={cn("input flex min-h-[42px] items-center gap-2", isOpen && "border-navy-500 ring-2 ring-navy-500/20 dark:border-gold-500 dark:ring-gold-500/20",
          invalid && "input-error", disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer")}>
        <span className="flex min-w-0 flex-1 flex-wrap gap-1.5">
          {selectedOptions.length ? selectedOptions.map((o) => (
            <span key={o.value} className="inline-flex animate-scale-in items-center gap-1 rounded-lg bg-navy-900 py-0.5 pl-2 pr-1 text-xs font-medium text-white dark:bg-gold-500/20 dark:text-gold-200 dark:ring-1 dark:ring-gold-500/30">
              {o.label}
              {!disabled && (
                <span role="button" tabIndex={-1} aria-label={`Quitar ${o.label}`} className="rounded p-0.5 hover:bg-white/20"
                  onClick={(e) => { e.stopPropagation(); toggle(o.value); }}><X className="h-3 w-3" /></span>
              )}
            </span>
          )) : <span className="text-slate-400">{placeholder}</span>}
        </span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200", isOpen && "rotate-180")} />
      </div>

      {isOpen && coords && createPortal(
        <div ref={panelRef} style={{ top: coords.top, left: coords.left, width: coords.width }}
          className="fixed z-[100] flex max-h-[360px] animate-scale-in flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lift dark:border-white/10 dark:bg-ink-800">
          <div className="flex items-center gap-2 border-b border-slate-100 px-3 dark:border-white/5">
            <Search className="h-4 w-4 text-slate-400" />
            <input autoFocus className="w-full bg-transparent py-2.5 text-sm outline-none placeholder:text-slate-400" placeholder="Buscar…"
              value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
          <div className="flex items-center justify-between border-b border-slate-100 px-3 py-1.5 text-xs dark:border-white/5">
            <span className="tabular-nums text-slate-400">{value.length} de {options.length}</span>
            <span className="flex gap-1">
              <button type="button" className="rounded-lg px-2 py-1 font-semibold text-navy-700 hover:bg-slate-100 dark:text-gold-400 dark:hover:bg-white/5"
                onClick={() => onChange([...new Set([...value, ...visible.filter((o) => !o.disabled).map((o) => o.value)])])}>Seleccionar todo</button>
              <button type="button" className="rounded-lg px-2 py-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5" onClick={() => onChange([])}>Limpiar</button>
            </span>
          </div>
          <ul role="listbox" aria-multiselectable="true" className="overflow-y-auto p-1.5">
            {visible.map((o) => {
              const on = chosen.has(o.value);
              return (
                <li key={o.value}>
                  <button type="button" role="option" aria-selected={on} disabled={o.disabled} onClick={() => toggle(o.value)}
                    className={cn("flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left text-sm transition-colors disabled:opacity-40",
                      on ? "bg-navy-50 text-navy-900 dark:bg-gold-500/10 dark:text-gold-200" : "text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/[.05]")}>
                    <span className={cn("flex h-4 w-4 shrink-0 items-center justify-center rounded-md border transition-colors",
                      on ? "border-navy-900 bg-navy-900 text-white dark:border-gold-500 dark:bg-gold-500 dark:text-navy-950" : "border-slate-300 dark:border-white/20")}>
                      {on && <Check className="h-3 w-3" strokeWidth={3} />}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate">{o.label}</span>
                      {o.hint && <span className="block truncate text-xs text-slate-400">{o.hint}</span>}
                    </span>
                  </button>
                </li>
              );
            })}
            {!visible.length && <li className="px-3 py-4 text-center text-xs text-slate-400">Sin resultados</li>}
          </ul>
        </div>,
        document.body,
      )}
    </>
  );
}
