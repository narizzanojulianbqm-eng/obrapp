/**
 * Motor de cálculo determinístico (sin IA): cómputo, análisis de precios, presupuesto, cronograma y avance.
 * Funciones puras: reciben datos y devuelven resultados. Se usan en el servidor y se pueden testear aisladas.
 */
import type { Item, Insumo, Recurso, Rubro, Obra } from "../db/schema";
import { ajustarHabil, habilesEntre, hoyISO, sumarHabiles } from "./calendario";

export const cantidadDe = (i: Pick<Item, "cantidadManual" | "cantidadCalc">) => i.cantidadManual ?? i.cantidadCalc;

const r2 = (n: number) => Math.round(n * 100) / 100;

// ───────── Cronograma ─────────
export function duracionPorRendimiento(cantidad: number, hhPorUnidad: number, cuadrillaHHdia: number, esHito: boolean): number {
  if (esHito) return 0;
  if (cantidad <= 0 || hhPorUnidad <= 0) return 1;
  return Math.max(1, Math.ceil((cantidad * hhPorUnidad) / Math.max(cuadrillaHHdia, 1)));
}

type ItemProg = Pick<Item, "id" | "duracion" | "predecesoras" | "inicioMin" | "esHito">;

/**
 * Programación hacia adelante (método de camino crítico simplificado) con dependencias
 * Fin-Comienzo (FC) y Comienzo-Comienzo (CC) con desfase en días hábiles.
 */
export function programar(items: ItemProg[], fechaInicio: string): Map<string, { inicio: string; fin: string }> {
  const porId = new Map(items.map((i) => [i.id, i]));
  const res = new Map<string, { inicio: string; fin: string }>();
  const visitando = new Set<string>();
  const inicioObra = ajustarHabil(fechaInicio);

  const calc = (id: string): { inicio: string; fin: string } => {
    const ya = res.get(id);
    if (ya) return ya;
    const it = porId.get(id)!;
    if (visitando.has(id)) return { inicio: inicioObra, fin: inicioObra }; // ciclo: se corta
    visitando.add(id);
    let inicio = inicioObra;
    if (it.inicioMin && it.inicioMin > inicio) inicio = ajustarHabil(it.inicioMin);
    for (const p of it.predecesoras ?? []) {
      if (!porId.has(p.id)) continue;
      const pp = calc(p.id);
      const pred = porId.get(p.id)!;
      let candidato: string;
      if (p.tipo === "CC") candidato = sumarHabiles(pp.inicio, p.desfase ?? 0);
      else candidato = sumarHabiles(pp.fin, (pred.esHito || pred.duracion === 0 ? 0 : 1) + (p.desfase ?? 0));
      if (candidato > inicio) inicio = candidato;
    }
    const dur = it.esHito ? 0 : Math.max(1, it.duracion);
    const fin = dur === 0 ? inicio : sumarHabiles(inicio, dur - 1);
    const r = { inicio, fin };
    res.set(id, r);
    visitando.delete(id);
    return r;
  };
  for (const i of items) calc(i.id);
  return res;
}

/** Detecta si agregar una predecesora genera un ciclo. */
export function generaCiclo(items: Pick<Item, "id" | "predecesoras">[], itemId: string, nuevaPred: string): boolean {
  const mapa = new Map(items.map((i) => [i.id, (i.predecesoras ?? []).map((p) => p.id)]));
  const stack = [nuevaPred];
  const vistos = new Set<string>();
  while (stack.length) {
    const x = stack.pop()!;
    if (x === itemId) return true;
    if (vistos.has(x)) continue;
    vistos.add(x);
    stack.push(...(mapa.get(x) ?? []));
  }
  return false;
}

// ───────── Análisis de precios y presupuesto ─────────
export type APU = {
  itemId: string;
  materiales: number;
  manoObra: number;
  equipos: number;
  unitario: number; // costo directo unitario
  hh: number;
  lineas: { recursoId: string; insumoId: string; nombre: string; tipo: Insumo["tipo"]; unidad: string; consumo: number; precio: number; subtotal: number }[];
  faltanPrecios: number;
};

export function analisisPrecios(item: Item, recursos: Recurso[], insumos: Map<string, Insumo>): APU {
  const lineas = recursos
    .filter((r) => r.itemId === item.id)
    .map((r) => {
      const ins = insumos.get(r.insumoId);
      const precio = ins?.precio ?? 0;
      return {
        recursoId: r.id,
        insumoId: r.insumoId,
        nombre: ins?.nombre ?? "?",
        tipo: ins?.tipo ?? "material",
        unidad: ins?.unidad ?? "",
        consumo: r.consumo,
        precio,
        subtotal: r.consumo * precio,
      };
    });
  const suma = (t: string) => lineas.filter((l) => l.tipo === t).reduce((a, l) => a + l.subtotal, 0);
  const materiales = suma("material"), manoObra = suma("mano_obra"), equipos = suma("equipo");
  return {
    itemId: item.id,
    materiales,
    manoObra,
    equipos,
    unitario: materiales + manoObra + equipos,
    hh: lineas.filter((l) => l.tipo === "mano_obra").reduce((a, l) => a + l.consumo, 0),
    lineas,
    faltanPrecios: lineas.filter((l) => l.precio <= 0).length,
  };
}

export type Presupuesto = ReturnType<typeof calcularPresupuesto>;

export function calcularPresupuesto(
  obra: Pick<Obra, "gastosGeneralesPct" | "beneficioPct" | "honorariosPct" | "ivaPct">,
  rubros: Rubro[],
  items: Item[],
  recursos: Recurso[],
  insumos: Insumo[],
) {
  const mapaIns = new Map(insumos.map((i) => [i.id, i]));
  const filasRubro = [...rubros]
    .sort((a, b) => a.orden - b.orden)
    .map((r) => {
      const its = items
        .filter((i) => i.rubroId === r.id && !i.esHito)
        .sort((a, b) => a.orden - b.orden)
        .map((i) => {
          const apu = analisisPrecios(i, recursos, mapaIns);
          const cant = cantidadDe(i);
          return { item: i, apu, cantidad: cant, parcial: cant * apu.unitario };
        });
      const subtotal = its.reduce((a, x) => a + x.parcial, 0);
      return {
        rubro: r,
        items: its,
        subtotal,
        materiales: its.reduce((a, x) => a + x.cantidad * x.apu.materiales, 0),
        manoObra: its.reduce((a, x) => a + x.cantidad * x.apu.manoObra, 0),
        equipos: its.reduce((a, x) => a + x.cantidad * x.apu.equipos, 0),
        incidencia: 0,
      };
    });
  const costoDirecto = filasRubro.reduce((a, r) => a + r.subtotal, 0);
  for (const f of filasRubro) f.incidencia = costoDirecto > 0 ? (f.subtotal / costoDirecto) * 100 : 0;
  const gastosGenerales = costoDirecto * (obra.gastosGeneralesPct / 100); // costos indirectos
  const costoObra = costoDirecto + gastosGenerales;
  const beneficio = costoObra * (obra.beneficioPct / 100);
  const honorarios = (costoObra + beneficio) * (obra.honorariosPct / 100);
  const subtotalSinIva = costoObra + beneficio + honorarios;
  const iva = subtotalSinIva * (obra.ivaPct / 100);
  const total = subtotalSinIva + iva;
  const coeficienteResumen = costoDirecto > 0 ? total / costoDirecto : 1;
  return {
    rubros: filasRubro,
    costoDirecto,
    materiales: filasRubro.reduce((a, r) => a + r.materiales, 0),
    manoObra: filasRubro.reduce((a, r) => a + r.manoObra, 0),
    equipos: filasRubro.reduce((a, r) => a + r.equipos, 0),
    gastosGenerales,
    costoObra,
    beneficio,
    honorarios,
    subtotalSinIva,
    iva,
    total,
    coeficienteResumen,
    faltanPrecios: insumos.filter((i) => i.precio <= 0 && recursos.some((r) => r.insumoId === i.id)).length,
  };
}

// ───────── Cómputo de materiales ─────────
export function computoMateriales(items: Item[], recursos: Recurso[], insumos: Insumo[]) {
  const porItem = new Map(items.map((i) => [i.id, i]));
  const acum = new Map<string, { insumo: Insumo; cantidad: number; usos: { itemId: string; nombre: string; cantidad: number }[] }>();
  for (const r of recursos) {
    const it = porItem.get(r.itemId);
    const ins = insumos.find((x) => x.id === r.insumoId);
    if (!it || !ins) continue;
    const q = cantidadDe(it) * r.consumo;
    if (q <= 0) continue;
    const a = acum.get(ins.id) ?? { insumo: ins, cantidad: 0, usos: [] };
    a.cantidad += q;
    a.usos.push({ itemId: it.id, nombre: it.nombre, cantidad: q });
    acum.set(ins.id, a);
  }
  return [...acum.values()]
    .map((a) => ({ ...a, cantidad: r2(a.cantidad), total: a.cantidad * a.insumo.precio }))
    .sort((a, b) => a.insumo.tipo.localeCompare(b.insumo.tipo) || a.insumo.nombre.localeCompare(b.insumo.nombre));
}

// ───────── Avance ─────────
/** Avance previsto (0-100) de un ítem a una fecha según el cronograma. */
export function avancePrevistoItem(i: Pick<Item, "inicio" | "fin" | "duracion" | "esHito">, fecha: string): number {
  if (!i.inicio || !i.fin) return 0;
  if (fecha < i.inicio) return 0;
  if (fecha > i.fin) return 100;
  if (i.esHito) return fecha >= i.inicio ? 100 : 0;
  const total = Math.max(1, i.duracion);
  const hechos = habilesEntre(i.inicio, fecha); // días hábiles completos antes de hoy
  return Math.min(100, (hechos / total) * 100);
}

/** Avance ponderado por costo (si hay precios) o por duración. */
export function avanceGeneral(items: Item[], pesos?: Map<string, number>, fecha = hoyISO()) {
  const its = items.filter((i) => !i.esHito);
  const peso = (i: Item) => {
    const p = pesos?.get(i.id) ?? 0;
    return p > 0 ? p : Math.max(1, i.duracion);
  };
  const usarCosto = pesos && [...pesos.values()].some((v) => v > 0);
  const pf = (i: Item) => (usarCosto ? pesos!.get(i.id) ?? 0 : Math.max(1, i.duracion));
  const total = its.reduce((a, i) => a + (usarCosto ? pf(i) : peso(i)), 0) || 1;
  const real = its.reduce((a, i) => a + pf(i) * (i.avanceReal / 100), 0) / total * 100;
  const previsto = its.reduce((a, i) => a + pf(i) * (avancePrevistoItem(i, fecha) / 100), 0) / total * 100;
  return { real, previsto, desvio: real - previsto, ponderadoPor: usarCosto ? "costo" : "duración" };
}

export function itemsAtrasados(items: Item[], fecha = hoyISO()) {
  return items
    .filter((i) => !i.esHito && i.avanceReal < 100)
    .map((i) => ({ item: i, previsto: avancePrevistoItem(i, fecha) }))
    .filter((x) => x.previsto - x.item.avanceReal >= 15 || (x.item.fin && x.item.fin < fecha))
    .map((x) => ({ ...x, diasAtraso: x.item.fin && x.item.fin < fecha ? habilesEntre(x.item.fin, fecha) : 0 }));
}

export function finDeObra(items: Item[]): string | null {
  return items.reduce<string | null>((max, i) => (i.fin && (!max || i.fin > max) ? i.fin : max), null);
}

/** Curva de avance previsto (S) muestreada semanalmente entre inicio y fin. */
export function curvaPrevista(items: Item[], pesos: Map<string, number>, inicio: string, fin: string | null) {
  if (!fin) return [];
  const puntos: { fecha: string; previsto: number }[] = [];
  const d = new Date(inicio + "T00:00:00Z");
  const f = new Date(fin + "T00:00:00Z");
  while (d <= f) {
    const fecha = d.toISOString().slice(0, 10);
    puntos.push({ fecha, previsto: avanceGeneral(items, pesos, fecha).previsto });
    d.setUTCDate(d.getUTCDate() + 7);
  }
  puntos.push({ fecha: fin, previsto: 100 });
  return puntos;
}
