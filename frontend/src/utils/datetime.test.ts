import { describe, expect, it } from "vitest";
import { caracasToday, formatDate, fromCaracasInput, toCaracasInput } from "./datetime";

describe("datetime (America/Caracas, UTC-4)", () => {
  it("convierte ISO UTC a valor local de Venezuela", () => {
    expect(toCaracasInput("2026-10-09T13:30:00Z")).toBe("2026-10-09T09:30");
  });
  it("convierte el valor del input a ISO con desfase -04:00", () => {
    expect(fromCaracasInput("2026-10-09T09:30")).toBe("2026-10-09T09:30:00-04:00");
    expect(fromCaracasInput("")).toBeNull();
  });
  it("ida y vuelta conserva la hora", () => {
    const iso = fromCaracasInput("2026-12-31T23:15")!;
    expect(toCaracasInput(iso)).toBe("2026-12-31T23:15");
  });
  it("hoy en Venezuela cambia de día a las 04:00 UTC", () => {
    expect(caracasToday(new Date("2026-10-10T03:59:00Z"))).toBe("2026-10-09");
    expect(caracasToday(new Date("2026-10-10T04:00:00Z"))).toBe("2026-10-10");
  });
  it("formatea fechas puras sin desfase", () => {
    expect(formatDate("2026-01-05")).toBe("05/01/2026");
  });
});
