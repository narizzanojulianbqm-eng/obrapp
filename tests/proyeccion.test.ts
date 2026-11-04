import { describe, expect, it } from "vitest";
import { proyectarObra, proyectarRubro } from "../src/lib/engine/proyeccion";

describe("proyección al cierre", () => {
  it("sin avance usa lo presupuestado", () => {
    expect(proyectarRubro("a", "A", 1000, 0, 0).estimado).toBe(1000);
  });
  it("si ya se gastó más que el presupuesto sin avance, toma lo gastado", () => {
    expect(proyectarRubro("a", "A", 1000, 5, 1200).estimado).toBe(1200);
  });
  it("proyecta con la tendencia: 50% hecho gastando 600 de 1000 → 1200", () => {
    const r = proyectarRubro("a", "A", 1000, 50, 600);
    expect(r.estimado).toBeCloseTo(1200);
    expect(r.desvio).toBeCloseTo(200);
    expect(r.base).toBe("tendencia");
  });
  it("acota el factor a 1,5", () => {
    expect(proyectarRubro("a", "A", 1000, 20, 1000).estimado).toBeCloseTo(1000 + 800 * 1.5);
  });
  it("terminado: estimado = gastado", () => {
    expect(proyectarRubro("a", "A", 1000, 100, 950).estimado).toBe(950);
  });
  it("pondera el avance por el peso de cada tarea", () => {
    const o = proyectarObra([{ id: "r", nombre: "R", presupuestado: 1000, items: [{ peso: 3, avance: 100 }, { peso: 1, avance: 0 }] }], new Map([["r", 750]]));
    expect(o.filas[0].avance).toBeCloseTo(75);
    expect(o.estimado).toBeCloseTo(1000);
  });
});
