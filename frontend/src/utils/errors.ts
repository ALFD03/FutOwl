import { AxiosError } from "axios";

export type FieldErrors = Record<string, string>;

function flatten(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(flatten).filter(Boolean).join(" ");
  if (typeof value === "object") {
    return Object.entries(value as Record<string, unknown>)
      .map(([k, v]) => (k === "detail" || k === "non_field_errors" ? flatten(v) : `${k}: ${flatten(v)}`))
      .join(" · ");
  }
  return String(value);
}

/** Mensaje legible a partir de un error de la API. */
export function errorMessage(error: unknown, fallback = "Ocurrió un error inesperado."): string {
  if (error instanceof AxiosError) {
    if (!error.response) return "No hay conexión con el servidor.";
    const data = error.response.data as Record<string, unknown> | undefined;
    if (error.response.status === 403 && !data) return "No tiene permisos para esta acción.";
    if (data instanceof Blob) return fallback;
    const msg = flatten(data);
    return msg || fallback;
  }
  if (error instanceof Error) return error.message;
  return fallback;
}

/** Errores por campo para mostrarlos junto a cada input. */
export function fieldErrors(error: unknown): FieldErrors {
  if (!(error instanceof AxiosError) || !error.response?.data || typeof error.response.data !== "object") return {};
  const result: FieldErrors = {};
  Object.entries(error.response.data as Record<string, unknown>).forEach(([key, value]) => {
    if (key !== "detail" && key !== "non_field_errors") result[key] = flatten(value);
  });
  return result;
}
