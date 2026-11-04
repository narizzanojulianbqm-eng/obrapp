import "server-only";
/**
 * Consultas determinísticas sobre la base de datos real. Las usa el motor de conversación
 * (WhatsApp y asistente web). Cada función respeta el perfil: nunca devuelve datos financieros
 * internos a clientes u obreros.
 */
import { and, desc, eq, gte, inArray } from "drizzle-orm";
import { db, schema } from "../db";
import type { Rol } from "../db/schema";
import { resumenObra, obrasDelUsuario } from "../queries";
import { avancePrevistoItem, cantidadDe, finDeObra } from "../engine/calculos";
import { diasCorridos, fechaLarga, habilesEntre, hoyISO, sumarHabiles } from "../engine/calendario";
import { ars, num } from "../format";
import { normalizar } from "./texto";

export type Resp = { texto: string; media?: string[] };

export async function atrasadas(obraId: string): Promise<Resp> {
  const r = await resumenObra(obraId);
  if (!r.atrasados.length) return { texto: `✅ ${r.obra.nombre}: no hay tareas atrasadas. Avance real ${r.avance.real.toFixed(0)}% vs ${r.avance.previsto.toFixed(0)}% previsto.` };
  return {
    texto: `⏱ *Tareas atrasadas en ${r.obra.nombre}* (${r.atrasados.length})\n` +
      r.atrasados.map((a) => `• ${a.item.nombre}: ${a.item.avanceReal.toFixed(0)}% real vs ${a.previsto.toFixed(0)}% previsto${a.diasAtraso ? ` · ${a.diasAtraso} días hábiles vencida` : ""}`).join("\n"),
  };
}

export async function resumenAvance(obraId: string, rol: Rol): Promise<Resp> {
  const r = await resumenObra(obraId);
  const fin = finDeObra(r.items);
  const hoy = hoyISO();
  const enCurso = r.items.filter((i) => !i.esHito && i.avanceReal < 100 && i.inicio && i.inicio <= hoy);
  const L = [
    `🏗 *${r.obra.nombre}*`,
    `Avance real: *${r.avance.real.toFixed(0)}%* (previsto a hoy ${r.avance.previsto.toFixed(0)}%)`,
    `Fin estimado: ${fechaLarga(fin)}${fin ? ` (faltan ${Math.max(0, diasCorridos(hoy, fin))} días)` : ""}`,
  ];
  if (enCurso.length) L.push(`En curso: ${enCurso.slice(0, 5).map((i) => `${i.nombre} (${i.avanceReal.toFixed(0)}%)`).join(", ")}`);
  if (r.atrasados.length) L.push(`⚠ ${r.atrasados.length} tareas atrasadas`);
  if (rol === "arquitecto") {
    L.push(`Gastado: ${ars(r.reales.total)} de ${r.presupuesto.faltanPrecios ? "presupuesto incompleto" : ars(r.presupuesto.costoObra) + " de costo de obra"}`);
    if (r.solicitudesPendientes.length) L.push(`📦 ${r.solicitudesPendientes.length} solicitudes de materiales pendientes`);
  }
  return { texto: L.join("\n") };
}

export async function cuantoFalta(obraId: string): Promise<Resp> {
  const r = await resumenObra(obraId);
  const fin = finDeObra(r.items);
  const hoy = hoyISO();
  if (!fin) return { texto: "Todavía no hay cronograma cargado." };
  const proxHitos = r.items.filter((i) => i.esHito && i.inicio && i.inicio >= hoy).slice(0, 3);
  return {
    texto: `📅 Según el cronograma, la obra termina el *${fechaLarga(fin)}* (faltan ${Math.max(0, diasCorridos(hoy, fin))} días, ${Math.max(0, habilesEntre(hoy, fin))} hábiles).\nAvance real ${r.avance.real.toFixed(0)}%.` +
      (proxHitos.length ? `\nPróximos hitos: ${proxHitos.map((h) => `${h.nombre} (${fechaLarga(h.inicio)})`).join(", ")}` : "") +
      (r.avance.desvio < -5 ? `\nVa ${Math.abs(r.avance.desvio).toFixed(0)} puntos por detrás de lo previsto.` : ""),
  };
}

/** Rango de fechas ISO para "esta semana", "este mes", "hoy". */
export function periodo(t: string): { desde: string; hasta: string; label: string } {
  const hoy = hoyISO();
  const d = new Date(hoy + "T00:00:00Z");
  if (/mes/.test(t)) return { desde: hoy.slice(0, 8) + "01", hasta: hoy, label: "este mes" };
  if (/hoy/.test(t)) return { desde: hoy, hasta: hoy, label: "hoy" };
  const dow = (d.getUTCDay() + 6) % 7; // lunes = 0
  d.setUTCDate(d.getUTCDate() - dow);
  return { desde: d.toISOString().slice(0, 10), hasta: hoy, label: "esta semana" };
}

export async function gastos(obraId: string, texto: string): Promise<Resp> {
  const p = periodo(texto);
  const cs = await db.query.compras.findMany({ where: and(eq(schema.compras.obraId, obraId), gte(schema.compras.fecha, p.desde)) });
  const val = cs.filter((c) => c.fecha <= p.hasta && c.aprobacionCliente !== "rechazada");
  const total = val.reduce((a, c) => a + c.total, 0);
  if (!val.length) return { texto: `💰 No hay gastos registrados ${p.label}.` };
  return { texto: `💰 *Gastos ${p.label}*: ${ars(total)}\n` + val.slice(0, 10).map((c) => `• ${c.fecha.slice(8)}/${c.fecha.slice(5, 7)} ${c.descripcion}: ${ars(c.total)}`).join("\n") };
}

export async function presupuestoRubro(obraId: string, texto: string): Promise<Resp> {
  const r = await resumenObra(obraId);
  const t = normalizar(texto);
  const fr = r.presupuesto.rubros.find((x) => normalizar(x.rubro.nombre).split(" ").some((w) => w.length > 4 && t.includes(w)));
  if (!fr) {
    const L = r.presupuesto.rubros.filter((x) => x.subtotal > 0).map((x) => {
      const g = r.reales.porRubro.get(x.rubro.id) ?? 0;
      return `• ${x.rubro.nombre}: queda ${ars(x.subtotal - g)} de ${ars(x.subtotal)}`;
    });
    return { texto: `📊 *Saldo por rubro (costo directo)*\n${L.join("\n") || "El presupuesto todavía no tiene precios."}` };
  }
  const g = r.reales.porRubro.get(fr.rubro.id) ?? 0;
  return { texto: `📊 *${fr.rubro.nombre}*\nPresupuestado (costo directo): ${ars(fr.subtotal)}\nGastado: ${ars(g)}\nQueda: *${ars(fr.subtotal - g)}* (${fr.subtotal ? (((fr.subtotal - g) / fr.subtotal) * 100).toFixed(0) : 0}%)` };
}

export async function materialesProximos(obraId: string): Promise<Resp> {
  const r = await resumenObra(obraId);
  const manana = sumarHabiles(hoyISO(), 1);
  const its = r.items.filter((i) => !i.esHito && i.avanceReal < 100 && i.inicio && i.inicio <= manana && (i.fin ?? "") >= hoyISO());
  const ins = new Map(r.insumos.map((i) => [i.id, i]));
  const acum = new Map<string, number>();
  for (const it of its) {
    const restante = cantidadDe(it) * (1 - it.avanceReal / 100);
    for (const rc of r.recursos.filter((x) => x.itemId === it.id)) {
      const i = ins.get(rc.insumoId);
      if (i?.tipo === "material") acum.set(i.id, (acum.get(i.id) ?? 0) + restante * rc.consumo);
    }
  }
  const sol = await db.query.solicitudes.findMany({ where: and(eq(schema.solicitudes.obraId, obraId), inArray(schema.solicitudes.estado, ["pendiente", "aprobada"])) });
  const L = [`📦 *Materiales para las tareas de mañana (${fechaLarga(manana)})*`];
  if (!its.length) L.push("No hay tareas activas para mañana.");
  else {
    L.push(`Tareas: ${its.map((i) => i.nombre).join(", ")}`);
    L.push(...[...acum.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([id, q]) => `• ${ins.get(id)!.nombre}: ${num(q, 1)} ${ins.get(id)!.unidad}`));
    L.push("_(cantidades pendientes según cómputo; descontá el stock en obra)_");
  }
  if (sol.length) L.push(`\nSolicitudes sin comprar: ${sol.map((s) => `${num(s.cantidad)} ${s.unidad} ${s.material} (${s.estado})`).join("; ")}`);
  return { texto: L.join("\n") };
}

export type PendienteAprobacion = { tipo: "solicitud" | "compra" | "adicional" | "cambio"; id: string; texto: string };

export async function pendientesAprobacion(obraId: string, rol: Rol): Promise<{ resp: Resp; lista: PendienteAprobacion[] }> {
  const lista: PendienteAprobacion[] = [];
  if (rol === "arquitecto") {
    const sol = await db.query.solicitudes.findMany({ where: and(eq(schema.solicitudes.obraId, obraId), eq(schema.solicitudes.estado, "pendiente")), orderBy: desc(schema.solicitudes.createdAt) });
    sol.forEach((s) => lista.push({ tipo: "solicitud", id: s.id, texto: `Solicitud: ${num(s.cantidad)} ${s.unidad} de ${s.material}${s.prioridad === "urgente" ? " (URGENTE)" : ""}` }));
    const cam = await db.query.cambios.findMany({ where: and(eq(schema.cambios.obraId, obraId), eq(schema.cambios.estado, "solicitado")) });
    cam.forEach((c) => lista.push({ tipo: "cambio", id: c.id, texto: `Cambio pedido por el cliente: ${c.descripcion.slice(0, 80)} (evaluar en la web)` }));
  } else if (rol === "cliente") {
    const ad = await db.query.adicionales.findMany({ where: and(eq(schema.adicionales.obraId, obraId), eq(schema.adicionales.estado, "pendiente")) });
    ad.forEach((a) => lista.push({ tipo: "adicional", id: a.id, texto: `Adicional: ${a.titulo} por ${ars(a.monto)}` }));
    const cs = await db.query.compras.findMany({ where: and(eq(schema.compras.obraId, obraId), eq(schema.compras.aprobacionCliente, "pendiente")) });
    cs.forEach((c) => lista.push({ tipo: "compra", id: c.id, texto: `Compra: ${c.descripcion} por ${ars(c.total)}` }));
  }
  if (!lista.length) return { lista, resp: { texto: rol === "cliente" ? "✅ No tenés decisiones pendientes." : "✅ No hay pedidos esperando tu aprobación." } };
  const aprobables = lista.filter((l) => l.tipo !== "cambio");
  return {
    lista,
    resp: {
      texto: `📝 *${rol === "cliente" ? "Decisiones pendientes" : "Pendientes de aprobación"}*\n` + lista.map((l, i) => `${i + 1}. ${l.texto}`).join("\n") +
        (aprobables.length ? `\n\nRespondé por ejemplo *"aprobar 1"* o *"rechazar 2"*.` : ""),
    },
  };
}

export async function personalHoy(obraId: string): Promise<Resp> {
  const hoy = hoyISO();
  const inicio = new Date(hoy + "T00:00:00-03:00");
  const av = await db.query.avances.findMany({ where: and(eq(schema.avances.obraId, obraId), gte(schema.avances.createdAt, inicio)) });
  const asis = await db.query.auditoria.findMany({ where: and(eq(schema.auditoria.obraId, obraId), eq(schema.auditoria.accion, "asistencia"), gte(schema.auditoria.createdAt, inicio)) });
  const autores = new Set(av.map((a) => a.autorId));
  const partes = asis.map((a) => a.detalle).filter(Boolean);
  const r = await resumenObra(obraId);
  const enCurso = r.items.filter((i) => !i.esHito && i.avanceReal < 100 && i.inicio && i.inicio <= hoy && (i.fin ?? "") >= hoy);
  const responsables = new Set(enCurso.map((i) => i.asignadoA).filter(Boolean));
  return {
    texto: `👷 *Personal hoy*\n` +
      (partes.length ? `Partes de asistencia: ${partes.join("; ")}\n` : "No se informó asistencia hoy (el encargado puede mandar \"hoy somos 4\").\n") +
      `${autores.size} persona(s) informaron avances hoy · ${responsables.size} responsables asignados a ${enCurso.length} tareas en curso.`,
  };
}

/** Lo que el cliente tiene que pagar este mes (según flujo previsto y compras pendientes de pago). */
export async function pagosDelMes(obraId: string): Promise<Resp> {
  const r = await resumenObra(obraId);
  const mes = hoyISO().slice(0, 7);
  const coef = r.presupuesto.coeficienteResumen;
  let previsto = 0;
  for (const fr of r.presupuesto.rubros) for (const x of fr.items) {
    const it = x.item;
    if (!it.inicio || !it.fin || x.parcial <= 0) continue;
    const d0 = new Date(it.inicio + "T00:00:00Z"), d1 = new Date(it.fin + "T00:00:00Z");
    const dias = Math.round((d1.getTime() - d0.getTime()) / 86400000) + 1;
    for (let k = 0; k < dias; k++) { const d = new Date(d0); d.setUTCDate(d.getUTCDate() + k); if (d.toISOString().startsWith(mes)) previsto += (x.parcial * coef) / dias; }
  }
  const aPagar = r.reales.compras.filter((c) => c.aprobacionCliente !== "rechazada" && c.total > c.pagado);
  return {
    texto: `💵 *Pagos de ${mes.slice(5)}/${mes.slice(0, 4)}*\n` +
      (r.presupuesto.faltanPrecios ? "El presupuesto todavía está en preparación.\n" : `Avance de obra previsto para este mes: ${ars(previsto)} (según cronograma y presupuesto aprobado)\n`) +
      (aPagar.length ? `Compras pendientes de pago: ${ars(aPagar.reduce((a, c) => a + c.total - c.pagado, 0))}\n` : "") +
      `_El monto exacto a abonar lo confirma el arquitecto según el plan de pagos acordado._`,
  };
}

/** Fotos de avances relacionadas con un tema ("baño", "cocina", "losa"…). */
export async function fotosDe(obraId: string, texto: string, rol: Rol): Promise<Resp> {
  const t = normalizar(texto);
  const r = await resumenObra(obraId);
  const palabras = t.split(" ").filter((w) => w.length > 3 && !["como", "quedo", "mostrar", "pueden", "podes", "fotos", "foto", "mandame", "mostrame"].includes(w));
  const items = r.items.filter((i) => palabras.some((w) => normalizar(i.nombre).includes(w.slice(0, 5))));
  const av = await db.query.avances.findMany({ where: eq(schema.avances.obraId, obraId), orderBy: desc(schema.avances.createdAt), limit: 100 });
  let fotos = av.filter((a) => a.tipo === "avance" || rol !== "cliente").filter((a) => !items.length || items.some((i) => i.id === a.itemId)).flatMap((a) => a.fotos);
  const docs = fotos.length ? await db.query.documentos.findMany({ where: inArray(schema.documentos.id, fotos) }) : [];
  fotos = fotos.filter((f) => docs.find((d) => d.id === f && (rol !== "cliente" || d.visibleCliente))).slice(0, 4);
  if (!fotos.length) return { texto: items.length ? `Todavía no hay fotos de ${items.map((i) => i.nombre).slice(0, 2).join(" / ")}.` : "No encontré fotos de eso todavía." };
  return { texto: `📷 Te mando las últimas fotos${items.length ? ` de ${items[0].nombre}` : ""}:`, media: fotos };
}

export async function tareasDelObrero(obraId: string, miembroId: string | null): Promise<Resp> {
  const r = await resumenObra(obraId);
  const hoy = hoyISO();
  const lim = sumarHabiles(hoy, 5);
  const its = r.items.filter((i) => !i.esHito && i.avanceReal < 100 && i.inicio && i.inicio <= lim && (!i.asignadoA || i.asignadoA === miembroId));
  if (!its.length) return { texto: "No tenés tareas para esta semana." };
  return { texto: `🛠 *Tus tareas*\n` + its.slice(0, 8).map((i) => `• ${i.nombre}: ${num(cantidadDe(i))} ${i.unidad} · ${i.inicio! <= hoy ? `hasta ${fechaLarga(i.fin)}` : `empieza ${fechaLarga(i.inicio)}`} · ${i.avanceReal.toFixed(0)}% (previsto ${avancePrevistoItem(i, hoy).toFixed(0)}%)`).join("\n") };
}

export async function informeSemanal(user: { id: string; email: string }): Promise<Resp> {
  const obras = (await obrasDelUsuario(user)).filter((o) => o.rol === "arquitecto" && o.obra.estado !== "finalizada");
  if (!obras.length) return { texto: "No tenés obras activas como arquitecto." };
  const p = periodo("semana");
  const L = [`📋 *Informe semanal* (${fechaLarga(p.desde)} – ${fechaLarga(p.hasta)})`];
  for (const o of obras) {
    const r = await resumenObra(o.obra.id);
    const gast = r.reales.compras.filter((c) => c.fecha >= p.desde).reduce((a, c) => a + c.total, 0);
    const avs = await db.query.avances.findMany({ where: and(eq(schema.avances.obraId, o.obra.id), gte(schema.avances.createdAt, new Date(p.desde + "T00:00:00-03:00"))) });
    L.push(`\n*${o.obra.nombre}*\n• Avance ${r.avance.real.toFixed(0)}% (previsto ${r.avance.previsto.toFixed(0)}%)\n• ${avs.filter((a) => a.tipo === "avance").length} avances y ${avs.filter((a) => a.tipo === "problema").length} problemas informados\n• Gastos de la semana: ${ars(gast)}\n• Atrasadas: ${r.atrasados.length} · Solicitudes pendientes: ${r.solicitudesPendientes.length}`);
  }
  return { texto: L.join("\n") };
}
