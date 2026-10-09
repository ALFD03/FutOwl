import type { ReactNode } from "react";

import type { ResourceService, Query } from "@/services/resource";

export interface Option {
  value: string | number;
  label: string;
  hint?: string;
}

export type FieldType =
  | "text" | "email" | "password" | "number" | "date" | "datetime" | "year" | "textarea" | "select"
  | "multiselect" | "checkbox" | "image" | "file" | "vat" | "phone" | "state" | "remote" | "custom";

export type Values = Record<string, unknown>;

export interface CustomFieldContext {
  values: Values;
  setValue: (name: string, value: unknown) => void;
  errors: Record<string, string>;
}

export interface FieldDef {
  name: string;
  label: string;
  type: FieldType;
  required?: boolean;
  /** Texto de ayuda; puede depender de lo que se va escribiendo. */
  help?: string | ((values: Values) => string | undefined);
  placeholder?: string;
  options?: Option[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  source?: { service: ResourceService<any>; label: (row: any) => string; hint?: (row: any) => string; params?: Query };
  /** Tipo "remote": búsqueda en el servidor; `selectedLabel` muestra el valor actual al editar. */
  remote?: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    service: ResourceService<any>; label: (row: any) => string; hint?: (row: any) => string; params?: Query;
    selectedLabel?: (values: Values) => string | undefined;
  };
  /** Tipo "custom": control propio que puede escribir varios valores (`emits`). */
  render?: (ctx: CustomFieldContext) => ReactNode;
  emits?: string[];
  initial?: (source: Values | null | undefined) => Values;
  wide?: boolean;
  hidden?: (values: Values) => boolean;
  disabled?: (values: Values) => boolean;
  min?: number;
  max?: number;
  step?: number | string;
  accept?: string;
  section?: string;
  /** Valor por defecto al crear */
  defaultValue?: unknown;
}
