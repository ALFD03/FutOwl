import { useQuery } from "@tanstack/react-query";

import { cn } from "@/utils/cn";

import { DateTimeInput, FileInput, MultiSelect, StateSelect, VatInput } from "./inputs";
import type { FieldDef, Option, Values } from "./types";

function useOptions(field: FieldDef): Option[] {
  const { data } = useQuery({
    queryKey: ["options", field.source?.service.path, field.source?.params],
    queryFn: () => field.source!.service.all({ is_active: true, ...field.source!.params }),
    enabled: Boolean(field.source),
    staleTime: 60_000,
  });
  if (field.options) return field.options;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((row: any) => ({ value: row.id, label: field.source!.label(row) }));
}

export function FormField({ field, values, setValue, error }: {
  field: FieldDef; values: Values; setValue: (name: string, value: unknown) => void; error?: string;
}) {
  const options = useOptions(field);
  const value = values[field.name];
  const disabled = field.disabled?.(values);
  const id = `f-${field.name}`;
  const common = { id, disabled, className: cn("input", error && "input-error") };

  let control;
  switch (field.type) {
    case "textarea":
      control = <textarea {...common} className={cn(common.className, "min-h-[110px]")} value={String(value ?? "")} placeholder={field.placeholder}
        onChange={(e) => setValue(field.name, e.target.value)} />;
      break;
    case "select":
      control = (
        <select {...common} value={value == null ? "" : String(value)}
          onChange={(e) => {
            const raw = e.target.value;
            const opt = options.find((o) => String(o.value) === raw);
            setValue(field.name, raw === "" ? null : opt ? opt.value : raw);
          }}>
          <option value="">{field.placeholder ?? "Seleccione…"}</option>
          {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      );
      break;
    case "multiselect":
      control = <MultiSelect options={options} value={(value as (string | number)[]) ?? []} disabled={disabled}
        onChange={(v) => setValue(field.name, v)} />;
      break;
    case "checkbox":
      control = (
        <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 px-3 py-2.5 dark:border-white/10">
          <input id={id} type="checkbox" className="h-4 w-4 accent-navy-900 dark:accent-gold-500" checked={Boolean(value)} disabled={disabled}
            onChange={(e) => setValue(field.name, e.target.checked)} />
          <span className="text-sm">{field.placeholder ?? field.label}</span>
        </label>
      );
      break;
    case "image":
    case "file":
      control = <FileInput value={value} image={field.type === "image"} accept={field.accept} disabled={disabled}
        onChange={(f) => setValue(field.name, f)} />;
      break;
    case "vat":
      control = <VatInput type={String(values.vat_id ?? "V")} number={String(values.vat_number ?? "")} invalid={Boolean(error)} disabled={disabled}
        onType={(v) => setValue("vat_id", v)} onNumber={(v) => setValue("vat_number", v)} />;
      break;
    case "datetime":
      control = <DateTimeInput value={value as string} invalid={Boolean(error)} disabled={disabled} onChange={(v) => setValue(field.name, v)} />;
      break;
    case "state":
      control = <StateSelect value={String(value ?? "")} invalid={Boolean(error)} disabled={disabled} onChange={(v) => setValue(field.name, v)} />;
      break;
    case "number":
    case "year":
      control = <input {...common} type="number" min={field.min} max={field.max} step={field.step ?? 1} value={value == null ? "" : String(value)}
        placeholder={field.placeholder} onChange={(e) => setValue(field.name, e.target.value === "" ? null : Number(e.target.value))} />;
      break;
    case "phone":
      control = <input {...common} type="tel" inputMode="tel" placeholder={field.placeholder ?? "+58 412-1234567"} value={String(value ?? "")}
        onChange={(e) => setValue(field.name, e.target.value.replace(/[^\d+\s-]/g, ""))} />;
      break;
    default:
      control = <input {...common} type={field.type} value={String(value ?? "")} placeholder={field.placeholder}
        autoComplete={field.type === "password" ? "new-password" : undefined}
        onChange={(e) => setValue(field.name, e.target.value)} />;
  }

  return (
    <div className={cn(field.wide && "sm:col-span-2")}>
      {field.type !== "checkbox" && (
        <label className="label" htmlFor={id}>
          {field.label} {field.required && <span className="text-crimson-500">*</span>}
        </label>
      )}
      {control}
      {error ? <p className="error-text">{error}</p> : field.help && <p className="help">{field.help}</p>}
    </div>
  );
}
