import { describe, expect, it } from "vitest";

import { headingsOf, slugify } from "./headings";

describe("slugify", () => {
  it("quita acentos, signos y espacios", () => {
    expect(slugify("Mesa técnica")).toBe("mesa-tecnica");
    expect(slugify("¿No veo mis partidos en Mis asignaciones?")).toBe("no-veo-mis-partidos-en-mis-asignaciones");
    expect(slugify("6. Cerrar la jornada")).toBe("6-cerrar-la-jornada");
  });
});

describe("headingsOf", () => {
  it("lista títulos de nivel 2 y 3 sin sintaxis en línea e ignora bloques de código", () => {
    const md = "# Título\n\n## Primeros **pasos**\n\n```\n## no es título\n```\n\n### Ver [Jornadas](/app/ayuda/jornadas)\n";
    expect(headingsOf(md)).toEqual([
      { level: 2, text: "Primeros pasos", id: "primeros-pasos" },
      { level: 3, text: "Ver Jornadas", id: "ver-jornadas" },
    ]);
  });
});
