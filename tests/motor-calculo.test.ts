import { describe, expect, it } from "vitest";
import { ajustarHabil, habilesEntre, sumarHabiles } from "../src/lib/engine/calendario";
import { avancePrevistoItem, calcularPresupuesto, duracionPorRendimiento, generaCiclo, programar } from "../src/lib/engine/calculos";
import { evaluarFormula, magnitudes, parametrosPorDefecto, plantillaPara } from "../src/lib/engine/plantillas";
import { extraerMateriales, extraerPorcentaje, normalizar } from "../src/lib/asistente/texto";
import { parseMonto } from "../src/lib/format";
import { normalizarTelefono } from "../src/lib/whatsapp/telefono";

describe("calendario de días hábiles", () => {
  it("salta fines de semana", () => {
    expect(ajustarHabil("2026-11-07")).toBe("2026-11-09"); // sábado → lunes
    expect(sumarHabiles("2026-11-06", 1)).toBe("2026-11-09"); // viernes + 1 → lunes
    expect(sumarHabiles("2026-11-09", -1)).toBe("2026-11-06");
  });
  it("cuenta días hábiles sin recursión infinita", () => {
    expect(habilesEntre("2026-11-09", "2026-11-09")).toBe(0);
    expect(habilesEntre("2026-11-09", "2026-11-16")).toBe(5);
    expect(habilesEntre("2026-11-16", "2026-11-09")).toBe(-5);
    expect(habilesEntre("fecha-mala", "2026-11-09")).toBe(0);
  });
});

describe("cronograma", () => {
  const base = { inicioMin: null, esHito: false };
  const items = [
    { ...base, id: "a", duracion: 3, predecesoras: [] },
    { ...base, id: "b", duracion: 2, predecesoras: [{ id: "a", tipo: "FC" as const, desfase: 0 }] },
    { ...base, id: "c", duracion: 4, predecesoras: [{ id: "a", tipo: "CC" as const, desfase: 1 }] },
  ];
  it("respeta fin-comienzo y comienzo-comienzo con desfase", () => {
    const p = programar(items, "2026-11-09");
    expect(p.get("a")).toEqual({ inicio: "2026-11-09", fin: "2026-11-11" });
    expect(p.get("b")).toEqual({ inicio: "2026-11-12", fin: "2026-11-13" });
    expect(p.get("c")!.inicio).toBe("2026-11-10");
  });
  it("detecta ciclos", () => {
    expect(generaCiclo(items, "a", "b")).toBe(true);
    expect(generaCiclo(items, "c", "b")).toBe(false);
  });
  it("calcula duración por rendimiento", () => {
    expect(duracionPorRendimiento(100, 1.6, 16, false)).toBe(10);
    expect(duracionPorRendimiento(0, 1, 16, false)).toBe(1);
    expect(duracionPorRendimiento(10, 1, 16, true)).toBe(0);
  });
  it("avance previsto: 0% el primer día, 100% después del fin", () => {
    const it0 = { inicio: "2026-11-09", fin: "2026-11-13", duracion: 5, esHito: false };
    expect(avancePrevistoItem(it0, "2026-11-09")).toBe(0);
    expect(avancePrevistoItem(it0, "2026-11-11")).toBe(40);
    expect(avancePrevistoItem(it0, "2026-11-20")).toBe(100);
  });
});

describe("plantillas y cómputo", () => {
  it("todas las dependencias de las plantillas existen", () => {
    for (const [tipo, sis] of [["vivienda_unifamiliar", "tradicional"], ["vivienda_unifamiliar", "steel_frame"], ["refaccion", "tradicional"]]) {
      const pl = plantillaPara(tipo, sis);
      const keys = new Set(pl.flatMap((r) => r.items.map((i) => i.key)));
      for (const r of pl) for (const i of r.items) for (const d of i.deps ?? []) expect(keys.has(typeof d === "string" ? d : d.key)).toBe(true);
    }
  });
  it("las cantidades escalan con la superficie", () => {
    const o = { tipo: "vivienda_unifamiliar", sistema: "tradicional", supCubierta: 100, supSemicubierta: 0, niveles: 1 };
    const o2 = { ...o, supCubierta: 200 };
    const q = (x: typeof o) => evaluarFormula("sup_cubierta", magnitudes(x, parametrosPorDefecto(x)));
    expect(q(o2)).toBe(2 * q(o));
  });
});

describe("presupuesto", () => {
  it("aplica coeficientes en cascada", () => {
    const obra = { gastosGeneralesPct: 10, beneficioPct: 10, honorariosPct: 10, ivaPct: 21 };
    const rubro = { id: "r", obraId: "o", orden: 1, codigo: "01", nombre: "R" };
    const item = { id: "i", obraId: "o", rubroId: "r", orden: 1, nombre: "I", unidad: "m2", cantidadCalc: 10, cantidadManual: null, esHito: false } as never;
    const insumo = { id: "x", obraId: "o", tipo: "material", nombre: "X", unidad: "u", precio: 100 } as never;
    const p = calcularPresupuesto(obra, [rubro], [item], [{ id: "rc", itemId: "i", insumoId: "x", consumo: 2 }], [insumo]);
    expect(p.costoDirecto).toBe(2000);
    expect(p.gastosGenerales).toBe(200);
    expect(p.beneficio).toBeCloseTo(220);
    expect(p.honorarios).toBeCloseTo(242);
    expect(p.total).toBeCloseTo((2000 + 200 + 220 + 242) * 1.21);
    expect(p.rubros[0].incidencia).toBe(100);
  });
});

describe("lenguaje de obra", () => {
  const ins = [
    { id: "c", tipo: "material", nombre: "Cemento portland (bolsa 50 kg)", unidad: "bolsa" },
    { id: "a", tipo: "material", nombre: "Adhesivo cementicio (bolsa 30 kg)", unidad: "bolsa" },
    { id: "h", tipo: "material", nombre: "Ladrillo cerámico hueco 12x18x33", unidad: "u" },
    { id: "f", tipo: "material", nombre: "Acero ADN 420 (barras)", unidad: "kg" },
  ] as never[];
  it("interpreta pedidos informales", () => {
    const m = extraerMateriales("Nos faltan 20 bolsas de cemento y 500 ladrillos huecos de 12 para mañana", ins);
    expect(m.map((x) => [x.cantidad, (x.insumo as { id: string } | undefined)?.id])).toEqual([[20, "c"], [500, "h"]]);
    expect((extraerMateriales("mandá 10 kg de hierro", ins)[0].insumo as { id: string }).id).toBe("f");
  });
  it("porcentajes y normalización", () => {
    expect(extraerPorcentaje("vamos por el 70%")).toBe(70);
    expect(extraerPorcentaje("70")).toBe(70);
    expect(normalizar("¿Cuánto FALTA?")).toBe("cuanto falta");
  });
  it("montos argentinos", () => {
    expect(parseMonto("11.500,50")).toBe(11500.5);
    expect(parseMonto("11.500")).toBe(11500);
    expect(parseMonto("11500.5")).toBe(11500.5);
    expect(parseMonto("$ 2.300.000")).toBe(2300000);
  });
  it("teléfonos argentinos al formato de WhatsApp", () => {
    expect(normalizarTelefono("11 5555 4444")).toBe("5491155554444");
    expect(normalizarTelefono("011 15 5555-4444")).toBe("5491155554444");
    expect(normalizarTelefono("+54 9 341 555 1234")).toBe("5493415551234");
    expect(normalizarTelefono("123")).toBeNull();
  });
});
