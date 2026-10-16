/**
 * Capacidad de una cancha según las medidas de juego de la categoría (igual que `Field.capacity_for` en el backend):
 * cuántas superficies de juego caben en la cancha, en cualquiera de las dos orientaciones. Sin medidas de juego, o si
 * la cancha no es divisible, se juega en la cancha completa (1).
 */
import type { Field, GameRules } from "@/types";

type Size = Pick<Field, "length_m" | "width_m" | "is_divisible">;
type PlaySize = Partial<Pick<GameRules, "play_length_m" | "play_width_m">> | null | undefined;

export function capacityFor(field: Size, rules: PlaySize): number {
  const length = Number(rules?.play_length_m) || 0;
  const width = Number(rules?.play_width_m) || 0;
  if (!field.is_divisible || !length || !width) return 1;
  const L = Number(field.length_m), W = Number(field.width_m);
  const fits = Math.max(Math.floor(L / length) * Math.floor(W / width), Math.floor(L / width) * Math.floor(W / length));
  return Math.max(1, fits);
}

const meters = (value: string | number) => Number(value).toLocaleString("es-VE", { maximumFractionDigits: 2 });

export const fieldSize = (f: Pick<Field, "length_m" | "width_m">) => `${meters(f.length_m)} × ${meters(f.width_m)} m`;

export const playSize = (rules: PlaySize) =>
  rules?.play_length_m && rules?.play_width_m ? `${meters(rules.play_length_m)} × ${meters(rules.play_width_m)} m` : "Cancha completa";
