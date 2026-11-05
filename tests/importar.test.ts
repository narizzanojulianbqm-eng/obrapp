import { describe, expect, it } from "vitest";
import { filasDesdeTexto, interpretarLinea } from "../src/lib/importar/texto";
import { vincularPlantilla } from "../src/lib/importar/vinculo";

const PRESUPUESTO = `
PRESUPUESTO Nº 0045 - Vivienda Gómez
Fecha: 10/10/2026
ITEM DESCRIPCIÓN UNIDAD CANTIDAD P. UNITARIO TOTAL
1 TRABAJOS PRELIMINARES
1.1 Limpieza del terreno m2 300 1.200,00 360.000,00
1.2 Obrador y cerco gl 1 1.600.000 1.600.000
2 MOVIMIENTO DE SUELOS
2.1 Excavación de zanjas para cimientos m3 18,5 $ 25.000 $ 462.500
3 ALBAÑILERÍA
3.1 Mampostería de ladrillo hueco 18x18x33 m2 145 32.500 4.712.500
3.2 Tabiques ladrillo hueco 12 m² 80 27.000 2.160.000
3.3 Revoque grueso y fino interior m2 420 14.500 6.090.000
4 PINTURA
4.1 Látex interior 2 manos m2 410 6.000 2.460.000
Subtotal 17.845.000
IVA 21% 3.747.450
TOTAL 21.592.450
`;

describe("lectura de presupuestos en texto", () => {
  it("interpreta una línea con cantidad, unitario y total", () => {
    expect(interpretarLinea("3.1 Mampostería de ladrillo hueco 18x18x33 m2 145 32.500 4.712.500")).toEqual({ nombre: "Mampostería de ladrillo hueco 18x18x33", unidad: "m2", cantidad: 145, precio: 32500 });
  });
  it("lee rubros e ítems e ignora totales", () => {
    const { filas } = filasDesdeTexto(PRESUPUESTO);
    expect(filas.map((f) => f.nombre)).toEqual([
      "Limpieza del terreno", "Obrador y cerco", "Excavación de zanjas para cimientos", "Mampostería de ladrillo hueco 18x18x33", "Tabiques ladrillo hueco 12", "Revoque grueso y fino interior", "Látex interior 2 manos",
    ]);
    expect(filas[0].rubro).toBe("Trabajos preliminares");
    expect(filas[3].rubro).toBe("Albañilería");
    expect(filas[2]).toMatchObject({ unidad: "m3", cantidad: 18.5, precio: 25000 });
    expect(filas[4].unidad).toBe("m2");
  });
  it("sin precios también funciona", () => {
    const { filas } = filasDesdeTexto("CONTRAPISOS\nContrapiso de hormigón pobre e=12cm m2 120\nCarpeta de nivelación m2 120");
    expect(filas).toHaveLength(2);
    expect(filas[0]).toMatchObject({ rubro: "Contrapisos", cantidad: 120, precio: null });
  });
});

describe("vínculo con las plantillas", () => {
  const caso = (n: string, u: string, r = "") => vincularPlantilla(n, u, r)?.key ?? null;
  it("reconoce tareas habituales", () => {
    expect(caso("Mampostería de ladrillo hueco 18x18x33", "m2")).toBe("muro_ext");
    expect(caso("Tabiques ladrillo hueco 12", "m2")).toBe("muro_int");
    expect(caso("Contrapiso de hormigón pobre e=12cm", "m2")).toBe("contrapiso");
    expect(caso("Látex interior 2 manos", "m2")).toBe("pintura_int");
    expect(caso("Excavación de zanjas para cimientos", "m3")).toBe("excavacion");
    expect(caso("Colocación de porcelanato 60x60", "m2")).toBe("piso");
    expect(caso("Instalación eléctrica completa", "boca")).toBe("electrica");
  });
  it("no inventa vínculos", () => {
    expect(caso("Pileta de natación", "gl")).toBeNull();
    expect(caso("Honorarios de agrimensor", "gl")).toBeNull();
  });
});
