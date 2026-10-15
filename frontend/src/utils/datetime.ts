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
/** Formatea sin romper la pantalla: un valor inválido se muestra como «—» (Intl lanza RangeError). */
const safe = (formatter: Intl.DateTimeFormat, value: string | number | Date) => {
  const date = toDate(value);
  return Number.isNaN(date.getTime()) ? "—" : formatter.format(date);
};

export const formatDate = (value?: string | null) => {
  if (!value) return "—";
  // Las fechas puras (YYYY-MM-DD) se muestran tal cual, sin conversión de zona.
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split("-");
    return `${d}/${m}/${y}`;
  }
  return safe(dateFmt, value);
};
export const formatTime = (value?: string | null) => (value ? safe(timeFmt, value) : "—");
export const formatDateTime = (value?: string | null) => (value ? safe(dateTimeFmt, value) : "—");
export const formatLongDate = (value: Date | string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(String(value)) ? safe(longDateFmt, `${value}T12:00:00${UTC_OFFSET}`) : safe(longDateFmt, value);
export const formatClock = (value: Date) => clockFmt.format(value);

/** Valor para <input type="datetime-local"> expresado en hora de Venezuela. */
export function toCaracasInput(iso?: string | null): string {
  if (!iso || Number.isNaN(new Date(iso).getTime())) return "";
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

/**
 * Hora «HH:MM» a partir de lo que entrega el navegador: algunos incluyen segundos («HH:MM:SS») y los que no
 * tienen selector de hora dejan escribir texto libre. Devuelve "" si está vacía y null si no es una hora válida.
 */
export function normalizeTime(value: string): string | null {
  const text = value.trim();
  if (!text) return "";
  const match = /^(\d{1,2}):(\d{2})(?::\d{2}(?:\.\d+)?)?$/.exec(text);
  if (!match) return null;
  const [hours, minutes] = [Number(match[1]), Number(match[2])];
  return hours < 24 && minutes < 60 ? `${String(hours).padStart(2, "0")}:${match[2]}` : null;
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
