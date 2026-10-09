import { useEffect, useMemo, useState } from "react";
import { FileText, ImagePlus, Search, X } from "lucide-react";

import { cn } from "@/utils/cn";
import { fromCaracasInput, toCaracasInput } from "@/utils/datetime";

import { VAT_TYPES, VENEZUELA_STATES } from "./constants";
import type { Option } from "./types";

export function MultiSelect({ options, value, onChange, disabled }: {
  options: Option[]; value: (string | number)[]; onChange: (v: (string | number)[]) => void; disabled?: boolean;
}) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(
    () => options.filter((o) => o.label.toLowerCase().includes(query.toLowerCase())),
    [options, query],
  );
  const toggle = (v: string | number) => onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);
  return (
    <div className={cn("rounded-xl border border-slate-300 bg-white p-2 dark:border-white/10 dark:bg-ink-700", disabled && "opacity-60")}>
      {options.length > 8 && (
        <div className="relative mb-2">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input className="input py-1.5 pl-8 text-xs" placeholder="Filtrar…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
      )}
      <div className="flex max-h-40 flex-wrap gap-1.5 overflow-y-auto">
        {filtered.map((o) => {
          const active = value.includes(o.value);
          return (
            <button type="button" key={o.value} disabled={disabled} onClick={() => toggle(o.value)}
              className={cn("rounded-full border px-3 py-1 text-xs font-medium transition-all",
                active ? "border-navy-800 bg-navy-900 text-white dark:border-gold-500 dark:bg-gold-500 dark:text-navy-950"
                  : "border-slate-200 text-slate-600 hover:border-navy-300 dark:border-white/10 dark:text-slate-300")}>
              {o.label}
            </button>
          );
        })}
        {filtered.length === 0 && <span className="px-1 text-xs text-slate-400">Sin opciones</span>}
      </div>
    </div>
  );
}

export function FileInput({ value, onChange, accept, image, disabled }: {
  value: unknown; onChange: (v: File | null) => void; accept?: string; image?: boolean; disabled?: boolean;
}) {
  const [preview, setPreview] = useState<string | null>(null);
  useEffect(() => {
    if (value instanceof File) {
      const url = URL.createObjectURL(value);
      setPreview(url);
      return () => URL.revokeObjectURL(url);
    }
    setPreview(typeof value === "string" && value ? value : null);
  }, [value]);
  const name = value instanceof File ? value.name : typeof value === "string" && value ? value.split("/").pop() : null;
  return (
    <div className="flex items-center gap-3">
      <label className={cn("group relative flex h-16 w-16 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 transition hover:border-gold-500 dark:border-white/15 dark:bg-ink-700", disabled && "pointer-events-none opacity-60")}>
        {image && preview ? <img src={preview} alt="" className="h-full w-full object-cover" />
          : image ? <ImagePlus className="h-6 w-6 text-slate-400 group-hover:text-gold-500" />
            : <FileText className="h-6 w-6 text-slate-400 group-hover:text-gold-500" />}
        <input type="file" className="sr-only" accept={accept} disabled={disabled}
          onChange={(e) => onChange(e.target.files?.[0] ?? null)} />
      </label>
      <div className="min-w-0 text-xs">
        {name ? (
          <div className="flex items-center gap-2">
            {typeof value === "string" ? <a href={value} target="_blank" rel="noreferrer" className="truncate text-navy-700 underline dark:text-gold-400">{name}</a>
              : <span className="truncate text-slate-600 dark:text-slate-300">{name}</span>}
            {value instanceof File && <button type="button" onClick={() => onChange(null)} className="text-slate-400 hover:text-crimson-600" aria-label="Quitar"><X className="h-3.5 w-3.5" /></button>}
          </div>
        ) : <span className="text-slate-400">Haga clic para adjuntar</span>}
        <p className="mt-0.5 text-slate-400">Se valida el tipo real del archivo.</p>
      </div>
    </div>
  );
}

export function VatInput({ type, number, onType, onNumber, invalid, disabled }: {
  type: string; number: string; onType: (v: string) => void; onNumber: (v: string) => void; invalid?: boolean; disabled?: boolean;
}) {
  return (
    <div className="flex gap-2">
      <select className="input w-20" value={type} onChange={(e) => onType(e.target.value)} disabled={disabled} aria-label="Tipo de documento">
        {VAT_TYPES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <input className={cn("input flex-1", invalid && "input-error")} inputMode="numeric" maxLength={9} placeholder="#########"
        value={number} disabled={disabled} onChange={(e) => onNumber(e.target.value.replace(/\D/g, ""))} aria-label="Número de documento" />
    </div>
  );
}

export function DateTimeInput({ value, onChange, disabled, invalid }: { value: string | null | undefined; onChange: (v: string | null) => void; disabled?: boolean; invalid?: boolean }) {
  return (
    <div className="relative">
      <input type="datetime-local" className={cn("input pr-16", invalid && "input-error")} value={toCaracasInput(value)} disabled={disabled}
        onChange={(e) => onChange(fromCaracasInput(e.target.value))} />
      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-slate-400">UTC-4</span>
    </div>
  );
}

export function StateSelect({ value, onChange, invalid, disabled }: { value: string; onChange: (v: string) => void; invalid?: boolean; disabled?: boolean }) {
  return (
    <select className={cn("input", invalid && "input-error")} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)}>
      <option value="">Seleccione…</option>
      {VENEZUELA_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
    </select>
  );
}
