import { describe, expect, it } from "vitest";
import { capacityFor, fieldSize, playSize } from "./fieldCapacity";

const big = { length_m: "100.00", width_m: "64.00", is_divisible: true };

describe("capacidad de la cancha por medidas de juego", () => {
  it("calcula cuántas superficies de juego entran (en cualquier orientación)", () => {
    expect(capacityFor(big, { play_length_m: "30", play_width_m: "25" })).toBe(8);
    expect(capacityFor(big, { play_length_m: "64", play_width_m: "50" })).toBe(2);
  });
  it("sin medidas, no divisible o más chica que la superficie: cancha completa", () => {
    expect(capacityFor(big, { play_length_m: null, play_width_m: null })).toBe(1);
    expect(capacityFor({ ...big, is_divisible: false }, { play_length_m: "30", play_width_m: "25" })).toBe(1);
    expect(capacityFor({ ...big, length_m: "40", width_m: "20" }, { play_length_m: "64", play_width_m: "50" })).toBe(1);
  });
  it("muestra las medidas", () => {
    expect(fieldSize(big)).toBe("100 × 64 m");
    expect(playSize({ play_length_m: "64.00", play_width_m: "50.00" })).toBe("64 × 50 m");
    expect(playSize(null)).toBe("Cancha completa");
  });
});
