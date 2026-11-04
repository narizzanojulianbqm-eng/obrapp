/** Chequeos automáticos de consistencia (sin IA, costo cero). Alimentan alertas y el contexto del asistente. */
import type { Item, Insumo, Recurso, Obra, Rubro } from "../db/schema";
import { cantidadDe, finDeObra, itemsAtrasados, type Presupuesto } from "./calculos";
import { diasCorridos, hoyISO } from "./calendario";

export type Alerta = { nivel: "info" | "aviso" | "critico"; texto: string; link?: string; modulo: string };

export function diagnosticar(args: {
  obra: Obra;
  rubros: Rubro[];
  items: Item[];
  insumos: Insumo[];
  recursos: Recurso[];
  presupuesto: Presupuesto;
  costoRealPorRubro: Map<string, number>;
  solicitudesPendientes: { id: string; createdAt: Date; prioridad: string }[];
}): Alerta[] {
  const { obra, items, insumos, recursos, presupuesto, costoRealPorRubro, solicitudesPendientes } = args;
  const base = `/obras/${obra.id}`;
  const a: Alerta[] = [];

  // Datos incompletos
  if (!obra.supCubierta) a.push({ nivel: "critico", modulo: "datos", texto: "Falta la superficie cubierta: sin ella no se pueden computar cantidades.", link: `${base}/datos` });
  if (!obra.clienteNombre) a.push({ nivel: "info", modulo: "datos", texto: "No se cargaron los datos del cliente.", link: `${base}/datos` });
  if (!obra.direccion) a.push({ nivel: "info", modulo: "datos", texto: "Falta la dirección de la obra (necesaria para buscar proveedores cercanos).", link: `${base}/datos` });

  const usados = new Set(recursos.map((r) => r.insumoId));
  const sinPrecio = insumos.filter((i) => usados.has(i.id) && i.precio <= 0);
  if (sinPrecio.length)
    a.push({ nivel: "aviso", modulo: "precios", texto: `${sinPrecio.length} de ${usados.size} insumos no tienen precio cargado; el presupuesto está incompleto.`, link: `${base}/precios` });

  const cero = items.filter((i) => !i.esHito && cantidadDe(i) <= 0);
  if (cero.length) a.push({ nivel: "info", modulo: "rubros", texto: `${cero.length} ítems tienen cantidad 0 (revisar o eliminar): ${cero.slice(0, 3).map((i) => i.nombre).join(", ")}${cero.length > 3 ? "…" : ""}.`, link: `${base}/rubros` });

  const sinRecursos = items.filter((i) => !i.esHito && !recursos.some((r) => r.itemId === i.id));
  if (sinRecursos.length) a.push({ nivel: "info", modulo: "precios", texto: `${sinRecursos.length} ítems no tienen análisis de precios (sin insumos asignados).`, link: `${base}/precios` });

  // Cronograma
  const fin = finDeObra(items);
  if (fin && obra.duracionEstimadaDias) {
    const dur = diasCorridos(obra.fechaInicio, fin);
    if (dur > obra.duracionEstimadaDias * 1.1)
      a.push({ nivel: "aviso", modulo: "gantt", texto: `El cronograma calculado dura ${dur} días corridos y supera la duración estimada (${obra.duracionEstimadaDias} días). Revisar cuadrillas, solapamientos o la estimación.`, link: `${base}/gantt` });
  }
  const atrasados = itemsAtrasados(items);
  if (atrasados.length)
    a.push({ nivel: "critico", modulo: "seguimiento", texto: `${atrasados.length} tareas atrasadas respecto de la planificación: ${atrasados.slice(0, 3).map((x) => x.item.nombre).join(", ")}${atrasados.length > 3 ? "…" : ""}.`, link: `${base}/seguimiento` });
  const sinAsignar = items.filter((i) => !i.esHito && !i.asignadoA && i.inicio && i.inicio <= hoyISO() && i.avanceReal < 100);
  if (sinAsignar.length) a.push({ nivel: "info", modulo: "seguimiento", texto: `${sinAsignar.length} tareas en curso no tienen responsable asignado.`, link: `${base}/rubros` });

  // Costos
  for (const fr of presupuesto.rubros) {
    const real = costoRealPorRubro.get(fr.rubro.id) ?? 0;
    if (fr.subtotal > 0 && real > fr.subtotal * 1.05)
      a.push({ nivel: "critico", modulo: "costos", texto: `El rubro "${fr.rubro.nombre}" lleva gastado ${Math.round((real / fr.subtotal) * 100)}% de su costo directo presupuestado.`, link: `${base}/costos` });
  }
  if (obra.presupuestoInicial && presupuesto.total > 0 && presupuesto.faltanPrecios === 0) {
    const d = (presupuesto.total / obra.presupuestoInicial - 1) * 100;
    if (Math.abs(d) > 10) a.push({ nivel: "aviso", modulo: "presupuesto", texto: `El presupuesto calculado difiere ${d.toFixed(0)}% del presupuesto inicial informado.`, link: `${base}/presupuesto` });
  }

  // Solicitudes
  const viejas = solicitudesPendientes.filter((s) => Date.now() - s.createdAt.getTime() > 2 * 86400000 || s.prioridad === "urgente");
  if (solicitudesPendientes.length)
    a.push({ nivel: viejas.length ? "aviso" : "info", modulo: "solicitudes", texto: `${solicitudesPendientes.length} solicitudes de materiales pendientes de respuesta${viejas.length ? ` (${viejas.length} urgentes o con más de 48 h)` : ""}.`, link: `${base}/solicitudes` });

  return a;
}
