import { useCallback } from "react";
import { useQuery } from "@tanstack/react-query";

import { SelectMenu, Switch } from "@/components/ui";
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
  return (data ?? []).map((row: any) => ({ value: row.id, label: field.source!.label(row), hint: field.source!.hint?.(row) }));
}

/** Búsqueda en el servidor para el tipo "remote" (p. ej. jugadores o representantes por nombre o cédula). */
export function useRemoteLoader(remote: FieldDef["remote"]) {
  return useCallback(async (query: string): Promise<Option[]> => {
    if (!remote) return [];
    const page = await remote.service.list({ is_active: true, search: query, ...remote.params });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return page.results.map((row: any) => ({ value: row.id, label: remote.label(row), hint: remote.hint?.(row) }));
  }, [remote]);
}

export function FormField({ field, values, setValue, error, errors = {} }: {
  field: FieldDef; values: Values; setValue: (name: string, value: unknown) => void; error?: string;
  errors?: Record<string, string>;
}) {
  const load = useRemoteLoader(field.remote);
  const help = typeof field.help === "function" ? field.help(values) : field.help;
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
      control = <SelectMenu id={id} value={value as string | number | null} options={options} disabled={disabled} invalid={Boolean(error)}
        placeholder={field.placeholder} clearable={!field.required} onChange={(v) => setValue(field.name, v)} />;
      break;
    case "remote":
      control = <SelectMenu id={id} value={value as string | number | null} load={load} disabled={disabled} invalid={Boolean(error)}
        placeholder={field.placeholder ?? "Buscar por nombre o cédula…"} searchPlaceholder="Nombre o cédula…" clearable={!field.required}
        selectedLabel={field.remote?.selectedLabel?.(values)} onChange={(v) => setValue(field.name, v)} />;
      break;
    case "multiselect":
      control = <MultiSelect options={options} value={(value as (string | number)[]) ?? []} disabled={disabled} invalid={Boolean(error)}
        onChange={(v) => setValue(field.name, v)} />;
      break;
    case "checkbox":
      control = <Switch checked={Boolean(value)} disabled={disabled} label={field.label} description={field.placeholder}
        onChange={(v) => setValue(field.name, v)} />;
      break;
    case "custom":
      control = field.render?.({ values, setValue, errors });
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
    <div className={cn((field.wide || field.type === "custom") && "sm:col-span-2")}>
      {field.type !== "checkbox" && field.type !== "custom" && (
        <label className="label" htmlFor={id}>
          {field.label} {field.required && <span className="text-crimson-500">*</span>}
        </label>
      )}
      {control}
      {error ? <p className="error-text">{error}</p> : help && <p className="help">{help}</p>}
    </div>
  );
}
