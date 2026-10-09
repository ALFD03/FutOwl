import { useEffect, useState } from "react";
import { FileText, ImagePlus, X } from "lucide-react";

import { MultiSelectMenu, SelectMenu } from "@/components/ui/SelectMenu";
import { cn } from "@/utils/cn";
import { fromCaracasInput, toCaracasInput } from "@/utils/datetime";

import { VAT_TYPES, VENEZUELA_STATES } from "./constants";
import type { Option } from "./types";

const STATE_OPTIONS: Option[] = VENEZUELA_STATES.map((state) => ({ value: state, label: state }));

/** Selección múltiple con desplegable propio (fichas + búsqueda). */
export function MultiSelect({ options, value, onChange, disabled, invalid }: {
  options: Option[]; value: (string | number)[]; onChange: (v: (string | number)[]) => void; disabled?: boolean; invalid?: boolean;
}) {
  return <MultiSelectMenu options={options} value={value} onChange={onChange} disabled={disabled} invalid={invalid} />;
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
      <div className="w-[4.5rem] shrink-0">
        <SelectMenu value={type} options={VAT_TYPES} onChange={(v) => onType(String(v ?? "V"))} disabled={disabled}
          aria-label="Tipo de documento" panelWidth={200} searchable={false} />
      </div>
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
    <SelectMenu value={value || null} options={STATE_OPTIONS} invalid={invalid} disabled={disabled}
      onChange={(v) => onChange(v == null ? "" : String(v))} placeholder="Seleccione el estado…" />
  );
}
