import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";

import { Alert, Spinner } from "@/components/ui";
import { errorMessage, fieldErrors, type FieldErrors } from "@/utils/errors";

import { FormField } from "./FormField";
import type { FieldDef, Values } from "./types";

const TEXT_TYPES = new Set(["text", "email", "password", "textarea", "phone", "state"]);

/** Valor vacío por tipo: texto → "", listas → [], casillas → false, resto → null. */
function emptyValue(field: FieldDef): unknown {
  if (field.type === "multiselect") return [];
  if (field.type === "custom") return undefined;
  if (field.type === "checkbox") return false;
  return TEXT_TYPES.has(field.type) ? "" : null;
}

export function initialValues(fields: FieldDef[], source?: Values | null): Values {
  const values: Values = {};
  fields.forEach((f) => {
    if (f.type === "vat") {
      values.vat_id = source?.vat_id ?? "V";
      values.vat_number = source?.vat_number ?? "";
      return;
    }
    if (f.type === "custom") {
      Object.assign(values, f.initial?.(source) ?? {});
      return;
    }
    values[f.name] = source?.[f.name] ?? f.defaultValue ?? emptyValue(f);
  });
  return values;
}

/** Formulario generado a partir de una definición de campos. */
export function ResourceForm({ fields, initial, onSubmit, submitLabel = "Guardar", onCancel, formId }: {
  fields: FieldDef[]; initial?: Values | null; onSubmit: (values: Values) => Promise<unknown>; submitLabel?: string;
  onCancel?: () => void; formId?: string;
}) {
  const [values, setValues] = useState<Values>(() => initialValues(fields, initial));
  const [errors, setErrors] = useState<FieldErrors>({});
  const [general, setGeneral] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);

  // Tras un intento fallido, lleva la vista al primer error: en formularios largos quedaba fuera de pantalla.
  useEffect(() => {
    if (!attempt) return;
    formRef.current?.querySelector(".error-text, [data-form-alert]")?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [attempt]);

  // Nombre visible de cada clave de error (incluye las que escriben los campos compuestos).
  const labels = useMemo(() => {
    const map: Record<string, string> = {};
    fields.forEach((f) => {
      map[f.name] = f.label;
      if (f.type === "vat") { map.vat_id = f.label; map.vat_number = f.label; }
      (f.emits ?? []).forEach((key) => { map[key] = f.label; });
    });
    return map;
  }, [fields]);
  const failed = [...new Set(Object.keys(errors).map((key) => labels[key] ?? key))];

  const setValue = (name: string, value: unknown) => setValues((v) => ({ ...v, [name]: value }));
  const sections = useMemo(() => {
    const map = new Map<string, FieldDef[]>();
    fields.forEach((f) => {
      const key = f.section ?? "";
      map.set(key, [...(map.get(key) ?? []), f]);
    });
    return [...map.entries()];
  }, [fields]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    setGeneral(null);
    try {
      const payload: Values = {};
      fields.forEach((f) => {
        if (f.hidden?.(values)) return;
        if (f.type === "vat") {
          payload.vat_id = values.vat_id;
          payload.vat_number = values.vat_number;
        } else if (f.type === "custom") {
          (f.emits ?? []).forEach((key) => { if (values[key] !== undefined) payload[key] = values[key]; });
        } else if ((f.type === "image" || f.type === "file") && !(values[f.name] instanceof File)) {
          return; // sin cambios en el archivo
        } else {
          payload[f.name] = values[f.name];
        }
      });
      await onSubmit(payload);
    } catch (error) {
      const errs = fieldErrors(error);
      setErrors(errs);
      const known = new Set([...fields.flatMap((f) => [f.name, ...(f.emits ?? [])]), "vat_id", "vat_number"]);
      const unknown = Object.keys(errs).some((k) => !known.has(k));
      if (!Object.keys(errs).length || unknown) setGeneral(errorMessage(error));
      setAttempt((n) => n + 1);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form ref={formRef} id={formId} onSubmit={submit} className="space-y-6" noValidate>
      {general && <div data-form-alert><Alert tone="danger">{general}</Alert></div>}
      {sections.map(([section, items]) => (
        <fieldset key={section} className="space-y-3">
          {section && <legend className="mb-2 text-sm font-bold text-navy-900 dark:text-gold-400">{section}</legend>}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {items.filter((f) => !f.hidden?.(values)).map((f) => (
              <FormField key={f.name} field={f} values={values} setValue={setValue} errors={errors}
                error={errors[f.name] ?? (f.type === "vat" ? errors.vat_number ?? errors.vat_id : undefined)} />
            ))}
          </div>
        </fieldset>
      ))}
      {failed.length > 0 && !general && (
        <Alert tone="danger">No se guardó. Revise: {failed.join(", ")}.</Alert>
      )}
      {!formId && (
        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4 dark:border-white/5">
          {onCancel && <button type="button" className="btn-ghost" onClick={onCancel}>Cancelar</button>}
          <button type="submit" className="btn-primary" disabled={busy}>{busy && <Spinner className="h-4 w-4" />}{submitLabel}</button>
        </div>
      )}
    </form>
  );
}
