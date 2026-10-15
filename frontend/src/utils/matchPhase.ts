/** Fase de un partido: grupo, fase regular sin grupo o ronda de la eliminación directa. */
import type { ID, Match, Registration } from "@/types";

/** Rondas de la eliminación directa en orden. */
export const KNOCKOUT_ORDER = ["r64", "r32", "r16", "qf", "sf", "final"];

/**
 * Grupo efectivo de un partido de fase regular: el guardado o, si se generó sin grupo, el de sus dos equipos
 * cuando ambos son del mismo grupo.
 */
export function groupResolver(registrations: Registration[]) {
  const groupOf = new Map(registrations.map((r) => [r.id, r.group]));
  return (m: Match): ID | null => {
    if (m.stage !== "regular") return null;
    if (m.group != null) return m.group;
    const home = m.home != null ? groupOf.get(m.home) : null;
    return home != null && home === (m.away != null ? groupOf.get(m.away) : null) ? home : null;
  };
}

/** Clave de fase para filtros: `g:<id>` (grupo), `regular` (fase regular sin grupo) o la ronda (`qf`…). */
export function phaseKey(m: Match, groupOf: (m: Match) => ID | null): string {
  if (m.stage !== "regular") return m.stage;
  const group = groupOf(m);
  return group != null ? `g:${group}` : "regular";
}
