/** Reglas de juego: campos del formulario, copia y resumen legible (categorías y ajustes por torneo). */
import type { FieldDef } from "@/components/forms";
import type { GameRules } from "@/types";
import { playSize } from "@/utils/fieldCapacity";

export const RULE_FIELDS: FieldDef[] = [
  { name: "match_duration_minutes", label: "Duración del partido (min)", type: "number", min: 10, max: 150, defaultValue: 60 },
  { name: "periods", label: "Tiempos", type: "number", min: 1, max: 4, defaultValue: 2 },
  { name: "break_minutes", label: "Descanso (min)", type: "number", defaultValue: 10 },
  { name: "max_substitutions", label: "Cambios máximos", type: "number", help: "Vacío = ilimitados" },
  { name: "max_lineup_players", label: "Jugadores por planilla", type: "number", defaultValue: 18 },
  { name: "starters_count", label: "Titulares", type: "number", defaultValue: 11 },
  { name: "referees_required", label: "Árbitros requeridos", type: "number", min: 1, max: 3, defaultValue: 3, help: "3 = terna completa" },
  { name: "play_length_m", label: "Largo de juego (m)", type: "number", min: 1, step: "0.01",
    help: "Medidas de la superficie en que se juega. Vacío = cancha completa" },
  { name: "play_width_m", label: "Ancho de juego (m)", type: "number", min: 1, step: "0.01",
    help: "En una cancha divisible entran tantos partidos a la vez como superficies quepan" },
];

export const pickRules = (r: GameRules): GameRules => ({
  match_duration_minutes: r.match_duration_minutes, periods: r.periods, break_minutes: r.break_minutes,
  max_substitutions: r.max_substitutions, max_lineup_players: r.max_lineup_players, starters_count: r.starters_count,
  referees_required: r.referees_required, play_length_m: r.play_length_m, play_width_m: r.play_width_m,
});

export const rulesSummary = (r: GameRules) => [
  { label: "Duración", value: `${r.match_duration_minutes} min · ${r.periods} tiempos · ${r.break_minutes} min descanso` },
  { label: "Planilla", value: `${r.max_lineup_players} jugadores · ${r.starters_count} titulares` },
  { label: "Cambios", value: r.max_substitutions ?? "Ilimitados" },
  { label: "Árbitros por partido", value: r.referees_required },
  { label: "Medidas de juego", value: playSize(r) },
];

/** Resumen corto en una línea (tablas). */
export const rulesLine = (r: GameRules) =>
  `${r.match_duration_minutes}′ · ${r.periods} T · ${r.max_lineup_players}/${r.starters_count} · ${r.max_substitutions ?? "∞"} cambios · ${r.referees_required} árb. · ${playSize(r)}`;
