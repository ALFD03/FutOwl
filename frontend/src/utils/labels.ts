import type { EventType, Party } from "@/types";

export const PARTY_LABELS: Record<Party, string> = {
  delegate: "Delegado",
  referee: "Árbitro principal",
  assistant_1: "Asistente 1",
  assistant_2: "Asistente 2",
  home: "Equipo local",
  away: "Equipo visitante",
};

export const EVENT_META: Record<EventType, { label: string; emoji: string; tone: string }> = {
  delegate_arrival: { label: "Llegada del delegado", emoji: "🧑‍💼", tone: "text-navy-600" },
  team_arrival: { label: "Llegada de equipo", emoji: "🚌", tone: "text-navy-600" },
  documents_verified: { label: "Documentación verificada", emoji: "📋", tone: "text-emerald-600" },
  kickoff: { label: "Inicio del partido", emoji: "🟢", tone: "text-emerald-600" },
  period_start: { label: "Inicio de tiempo", emoji: "▶️", tone: "text-emerald-600" },
  goal: { label: "Gol", emoji: "⚽", tone: "text-gold-600" },
  penalty_goal: { label: "Gol de penal", emoji: "🎯", tone: "text-gold-600" },
  own_goal: { label: "Autogol", emoji: "⚽", tone: "text-crimson-600" },
  yellow_card: { label: "Tarjeta amarilla", emoji: "🟨", tone: "text-amber-500" },
  red_card: { label: "Tarjeta roja", emoji: "🟥", tone: "text-crimson-600" },
  substitution: { label: "Cambio", emoji: "🔁", tone: "text-sky-600" },
  incident: { label: "Incidencia", emoji: "⚠️", tone: "text-amber-600" },
  period_end: { label: "Fin de tiempo", emoji: "⏸️", tone: "text-slate-500" },
  match_end: { label: "Fin del partido", emoji: "🏁", tone: "text-slate-700" },
  annulment: { label: "Anulación", emoji: "❌", tone: "text-crimson-600" },
  note: { label: "Nota", emoji: "📝", tone: "text-slate-500" },
};

export const REPORT_FIELD_LABELS: Record<string, string> = {
  home_score: "Goles local",
  away_score: "Goles visitante",
  home_yellow: "Amarillas local",
  away_yellow: "Amarillas visitante",
  home_red: "Rojas local",
  away_red: "Rojas visitante",
};

export const FIELD_LABELS: Record<string, string> = {
  matchday: "Jornada",
  field: "Cancha",
  scheduled_start: "Hora de inicio",
  scheduled_end: "Hora de fin",
  delegate: "Delegado",
  referee: "Árbitro principal",
  assistant_referee_1: "Asistente 1",
  assistant_referee_2: "Asistente 2",
  sub_field: "Mini cancha",
};
