/**
 * Utilidades de fecha/hora. Toda la aplicación trabaja en America/Caracas (UTC-4, sin horario de verano).
 */
export const TIME_ZONE = "America/Caracas";
export const UTC_OFFSET = "-04:00";
const LOCALE = "es-VE";

const fmt = (options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(LOCALE, { timeZone: TIME_ZONE, ...options });

const dateFmt = fmt({ day: "2-digit", month: "2-digit", year: "numeric" });
const timeFmt = fmt({ hour: "2-digit", minute: "2-digit", hour12: true });
const dateTimeFmt = fmt({ day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true });
const longDateFmt = fmt({ weekday: "long", day: "numeric", month: "long", year: "numeric" });
const clockFmt = fmt({ hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true });

const toDate = (value: string | number | Date) => (value instanceof Date ? value : new Date(value));

export const formatDate = (value?: string | null) => {
  if (!value) return "—";
  // Las fechas puras (YYYY-MM-DD) se muestran tal cual, sin conversión de zona.
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split("-");
    return `${d}/${m}/${y}`;
  }
  return dateFmt.format(toDate(value));
};
export const formatTime = (value?: string | null) => (value ? timeFmt.format(toDate(value)) : "—");
export const formatDateTime = (value?: string | null) => (value ? dateTimeFmt.format(toDate(value)) : "—");
export const formatLongDate = (value: Date | string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(String(value)) ? longDateFmt.format(new Date(`${value}T12:00:00${UTC_OFFSET}`)) : longDateFmt.format(toDate(value));
export const formatClock = (value: Date) => clockFmt.format(value);

/** Valor para <input type="datetime-local"> expresado en hora de Venezuela. */
export function toCaracasInput(iso?: string | null): string {
  if (!iso) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(new Date(iso));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  const hour = get("hour") === "24" ? "00" : get("hour");
  return `${get("year")}-${get("month")}-${get("day")}T${hour}:${get("minute")}`;
}

/** Convierte el valor de un datetime-local (hora de Venezuela) a ISO con desfase -04:00. */
export function fromCaracasInput(value: string): string | null {
  if (!value) return null;
  return `${value.length === 16 ? `${value}:00` : value}${UTC_OFFSET}`;
}

/** Fecha de hoy (YYYY-MM-DD) en Venezuela. */
export function caracasToday(now: Date = new Date()): string {
  return toCaracasInput(now.toISOString()).slice(0, 10);
}

export function relativeTime(iso: string, now = Date.now()): string {
  const diff = Math.round((new Date(iso).getTime() - now) / 1000);
  const rtf = new Intl.RelativeTimeFormat(LOCALE, { numeric: "auto" });
  const abs = Math.abs(diff);
  if (abs < 60) return rtf.format(diff, "second");
  if (abs < 3600) return rtf.format(Math.round(diff / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), "hour");
  return rtf.format(Math.round(diff / 86400), "day");
}
