import "server-only";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { db, schema } from "./db";
import { CATALOGO_INSUMOS, evaluarFormula, magnitudes, parametrosPorDefecto, plantillaPara } from "./engine/plantillas";
import { duracionPorRendimiento, programar, cantidadDe } from "./engine/calculos";
import type { Obra } from "./db/schema";

/** Genera rubros, ítems, insumos y análisis de precios a partir de la plantilla correspondiente. */
export async function generarDesdePlantilla(obra: Obra) {
  const plantilla = plantillaPara(obra.tipo, obra.sistema);

  // Insumos usados por la plantilla (sin precio: los carga el arquitecto)
  const claves = new Set<string>();
  plantilla.forEach((r) => r.items.forEach((i) => Object.keys(i.recursos).forEach((k) => claves.add(k))));
  const existentes = await db.query.insumos.findMany({ where: eq(schema.insumos.obraId, obra.id) });
  const insumoPorClave = new Map(existentes.filter((e) => e.clave).map((e) => [e.clave!, e.id]));
  const nuevos = [...claves].filter((k) => !insumoPorClave.has(k) && CATALOGO_INSUMOS[k]);
  if (nuevos.length) {
    const rows = nuevos.map((k) => ({ id: crypto.randomUUID(), obraId: obra.id, clave: k, ...CATALOGO_INSUMOS[k], precio: 0 }));
    await db.insert(schema.insumos).values(rows);
    rows.forEach((r) => insumoPorClave.set(r.clave, r.id));
  }

  const idPorKey = new Map<string, string>();
  plantilla.forEach((r) => r.items.forEach((i) => idPorKey.set(i.key, crypto.randomUUID())));

  const rubrosRows: (typeof schema.rubros.$inferInsert)[] = [];
  const itemsRows: (typeof schema.items.$inferInsert)[] = [];
  const recursosRows: (typeof schema.recursos.$inferInsert)[] = [];

  plantilla.forEach((r, ri) => {
    const rubroId = crypto.randomUUID();
    rubrosRows.push({ id: rubroId, obraId: obra.id, orden: ri + 1, codigo: String(ri + 1).padStart(2, "0"), nombre: r.nombre });
    r.items.forEach((it, ii) => {
      const id = idPorKey.get(it.key)!;
      const preds = (it.deps ?? [])
        .map((d) => (typeof d === "string" ? { key: d, tipo: "FC" as const, desfase: 0 } : { key: d.key, tipo: d.tipo ?? ("FC" as const), desfase: d.desfase ?? 0 }))
        .filter((d) => idPorKey.has(d.key))
        .map((d) => ({ id: idPorKey.get(d.key)!, tipo: d.tipo, desfase: d.desfase }));
      itemsRows.push({
        id,
        obraId: obra.id,
        rubroId,
        orden: ii + 1,
        plantillaKey: it.key,
        nombre: it.nombre,
        unidad: it.unidad,
        formula: it.formula,
        esHito: !!it.hito,
        predecesoras: preds,
        duracionManual: it.duracionFija ?? null,
      });
      for (const [k, consumo] of Object.entries(it.recursos)) {
        const insumoId = insumoPorClave.get(k);
        if (insumoId) recursosRows.push({ itemId: id, insumoId, consumo });
      }
    });
  });

  await db.insert(schema.rubros).values(rubrosRows);
  for (let i = 0; i < itemsRows.length; i += 50) await db.insert(schema.items).values(itemsRows.slice(i, i + 50));
  for (let i = 0; i < recursosRows.length; i += 100) await db.insert(schema.recursos).values(recursosRows.slice(i, i + 100));
  await recalcularObra(obra.id);
}

/**
 * Recalcula en cadena: parámetros → cantidades → rendimientos → duraciones → cronograma.
 * Se llama después de cualquier cambio que afecte a otros módulos.
 */
export async function recalcularObra(obraId: string) {
  const obra = await db.query.obras.findFirst({ where: eq(schema.obras.id, obraId) });
  if (!obra) return;
  const params = { ...parametrosPorDefecto(obra), ...(obra.parametros ?? {}) };
  const mag = magnitudes(obra, params);
  const its = await db.query.items.findMany({ where: eq(schema.items.obraId, obraId) });
  const ids = its.map((i) => i.id);
  const recs = ids.length ? await db.query.recursos.findMany({ where: inArray(schema.recursos.itemId, ids) }) : [];
  const ins = await db.query.insumos.findMany({ where: eq(schema.insumos.obraId, obraId) });
  const tipoIns = new Map(ins.map((i) => [i.id, i.tipo]));

  const actualizados = its.map((i) => {
    const cantidadCalc = i.formula ? evaluarFormula(i.formula, mag) : i.cantidadCalc;
    const hh = recs.filter((r) => r.itemId === i.id && tipoIns.get(r.insumoId) === "mano_obra").reduce((a, r) => a + r.consumo, 0);
    const cant = i.cantidadManual ?? cantidadCalc;
    const duracion = i.esHito ? 0 : i.duracionManual ?? duracionPorRendimiento(cant, hh, obra.cuadrillaHHdia, i.esHito);
    return { ...i, cantidadCalc, hhPorUnidad: hh, duracion };
  });
  const prog = programar(actualizados, obra.fechaInicio);
  const stmts = actualizados.map((i) => {
    const p = prog.get(i.id)!;
    return db
      .update(schema.items)
      .set({ cantidadCalc: i.cantidadCalc, hhPorUnidad: i.hhPorUnidad, duracion: i.duracion, inicio: p.inicio, fin: p.fin })
      .where(eq(schema.items.id, i.id));
  });
  if (stmts.length) await db.batch(stmts as [ (typeof stmts)[0], ...(typeof stmts)[0][] ]);
}

/** Carga todos los datos de una obra en una sola llamada. */
export async function cargarObra(obraId: string) {
  const [rubros, items, insumos, miembros] = await Promise.all([
    db.query.rubros.findMany({ where: eq(schema.rubros.obraId, obraId), orderBy: asc(schema.rubros.orden) }),
    db.query.items.findMany({ where: eq(schema.items.obraId, obraId), orderBy: asc(schema.items.orden) }),
    db.query.insumos.findMany({ where: eq(schema.insumos.obraId, obraId), orderBy: asc(schema.insumos.nombre) }),
    db.query.miembros.findMany({ where: eq(schema.miembros.obraId, obraId) }),
  ]);
  const recursos = items.length ? await db.query.recursos.findMany({ where: inArray(schema.recursos.itemId, items.map((i) => i.id)) }) : [];
  // ordenar ítems según orden de rubro
  const ordenRubro = new Map(rubros.map((r) => [r.id, r.orden]));
  items.sort((a, b) => (ordenRubro.get(a.rubroId)! - ordenRubro.get(b.rubroId)!) || a.orden - b.orden);
  return { rubros, items, insumos, recursos, miembros };
}

export async function siguienteCodigoObra(ownerId: string) {
  const [{ n }] = await db.select({ n: sql<number>`count(*)` }).from(schema.obras).where(eq(schema.obras.ownerId, ownerId));
  return `OB-${new Date().getFullYear()}-${String(Number(n) + 1).padStart(4, "0")}`;
}

/** Costo ejecutado por rubro (compras registradas). */
export async function costosReales(obraId: string) {
  const cs = await db.query.compras.findMany({ where: eq(schema.compras.obraId, obraId) });
  const porRubro = new Map<string, number>();
  let total = 0, pagado = 0, pendiente = 0;
  for (const c of cs) {
    if (c.aprobacionCliente === "rechazada") continue;
    total += c.total;
    pagado += c.pagado;
    pendiente += Math.max(0, c.total - c.pagado);
    if (c.rubroId) porRubro.set(c.rubroId, (porRubro.get(c.rubroId) ?? 0) + c.total);
  }
  return { compras: cs, porRubro, total, pagado, pendiente };
}

export { cantidadDe };
export const _and = and;
