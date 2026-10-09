import type { ResourceService, Query } from "@/services/resource";

export interface Option {
  value: string | number;
  label: string;
}

export type FieldType =
  | "text" | "email" | "password" | "number" | "date" | "datetime" | "year" | "textarea" | "select"
  | "multiselect" | "checkbox" | "image" | "file" | "vat" | "phone" | "state";

export type Values = Record<string, unknown>;

export interface FieldDef {
  name: string;
  label: string;
  type: FieldType;
  required?: boolean;
  help?: string;
  placeholder?: string;
  options?: Option[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  source?: { service: ResourceService<any>; label: (row: any) => string; params?: Query };
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
