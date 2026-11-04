import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { db, schema } from "./db";
import type { Rol } from "./db/schema";
import { PLANES } from "./planes";
import { resumenObra } from "./queries";
import { cantidadDe } from "./engine/calculos";
import { fechaLarga, hoyISO } from "./engine/calendario";
import { TIPOS_OBRA, SISTEMAS } from "./engine/plantillas";

export const aiDisponible = () => !!process.env.ANTHROPIC_API_KEY;
const MODELO = () => process.env.AI_MODEL || "claude-haiku-5-5";

export type AccionIA =
  | { tipo: "solicitud"; material: string; cantidad: number; unidad: string; prioridad?: "baja" | "media" | "alta" | "urgente"; tarea?: string; observaciones?: string }
  | { tipo: "tarea"; rubro: string; nombre: string; unidad: string; cantidad: number; duracion?: number }
  | { tipo: "mensaje"; canal: "general" | "cliente" | "obra"; texto: string };

/** Límite mensual: lo define el plan del titular de la obra (la plataforma paga y controla el consumo). */
export async function cupoIA(obraId: string) {
  const obra = (await db.query.obras.findFirst({ where: eq(schema.obras.id, obraId) }))!;
  const owner = (await db.query.users.findFirst({ where: eq(schema.users.id, obra.ownerId) }))!;
  const obrasOwner = (await db.query.obras.findMany({ where: eq(schema.obras.ownerId, owner.id), columns: { id: true } })).map((o) => o.id);
  const inicioMes = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const [{ n }] = await db
    .select({ n: sql<number>`count(*)` })
    .from(schema.aiUso)
    .where(and(inArray(schema.aiUso.obraId, obrasOwner), gte(schema.aiUso.createdAt, inicioMes)));
  const limite = PLANES[owner.plan].consultasIA;
  return { usadas: Number(n), limite, restante: Math.max(0, limite - Number(n)) };
}

/** Contexto compacto de la obra, filtrado por permisos. Se arma con código (sin gastar IA). */
export async function contextoObra(obraId: string, rol: Rol): Promise<string> {
  const r = await resumenObra(obraId);
  const { obra } = r;
  const verCostos = rol === "arquitecto";
  const nombreMiembro = new Map(r.miembros.map((m) => [m.id, m.nombre ?? m.email]));
  const L: string[] = [];
  L.push(`# Obra ${obra.codigo}: ${obra.nombre}`);
  L.push(`Tipo: ${TIPOS_OBRA[obra.tipo as keyof typeof TIPOS_OBRA] ?? obra.tipo}. Sistema: ${SISTEMAS[obra.sistema as keyof typeof SISTEMAS] ?? obra.sistema}.`);
  L.push(`Ubicación: ${[obra.direccion, obra.localidad, obra.provincia].filter(Boolean).join(", ") || "sin datos"}. Sup. cubierta ${obra.supCubierta} m², semicubierta ${obra.supSemicubierta} m², ${obra.niveles} nivel(es).`);
  L.push(`Inicio ${obra.fechaInicio}. Duración estimada informada: ${obra.duracionEstimadaDias ?? "s/d"} días. Estado: ${obra.estado}. Hoy: ${hoyISO()}.`);
  if (obra.caracteristicas) L.push(`Características: ${obra.caracteristicas}`);
  L.push(`Avance real ${r.avance.real.toFixed(1)}% vs previsto ${r.avance.previsto.toFixed(1)}% (ponderado por ${r.avance.ponderadoPor}).`);
  if (verCostos) {
    const p = r.presupuesto;
    L.push(`## Presupuesto (ARS)`);
    L.push(`Costo directo ${p.costoDirecto.toFixed(0)} (mat ${p.materiales.toFixed(0)}, MO ${p.manoObra.toFixed(0)}, equipos ${p.equipos.toFixed(0)}). GG ${obra.gastosGeneralesPct}%, beneficio ${obra.beneficioPct}%, honorarios ${obra.honorariosPct}%, IVA ${obra.ivaPct}%. Total ${p.total.toFixed(0)}. Insumos sin precio: ${p.faltanPrecios}.`);
    L.push(`Costo ejecutado (compras) ${r.reales.total.toFixed(0)}, pagado ${r.reales.pagado.toFixed(0)}.`);
  }
  L.push(`## Rubros e ítems (cantidad, fechas, avance${verCostos ? ", costo unitario directo" : ""})`);
  const apuPorItem = new Map(r.presupuesto.rubros.flatMap((fr) => fr.items.map((x) => [x.item.id, x.apu.unitario] as const)));
  for (const rb of r.rubros) {
    const its = r.items.filter((i) => i.rubroId === rb.id);
    const real = r.reales.porRubro.get(rb.id);
    L.push(`### ${rb.codigo} ${rb.nombre}${verCostos && real ? ` (gastado ${real.toFixed(0)})` : ""}`);
    for (const i of its) {
      const asign = i.asignadoA ? ` resp:${nombreMiembro.get(i.asignadoA)}` : "";
      L.push(`- ${i.nombre} | ${i.esHito ? "hito" : `${cantidadDe(i)} ${i.unidad}`} | ${i.inicio}→${i.fin} (${i.duracion}d) | avance ${i.avanceReal}%${asign}${verCostos ? ` | cu ${(apuPorItem.get(i.id) ?? 0).toFixed(0)}` : ""}`);
    }
  }
  if (r.atrasados.length) L.push(`## Atrasadas\n${r.atrasados.map((a) => `- ${a.item.nombre}: real ${a.item.avanceReal}% vs previsto ${a.previsto.toFixed(0)}%`).join("\n")}`);
  const alertas = r.alertas.filter((a) => verCostos || !["precios", "costos", "presupuesto"].includes(a.modulo));
  if (alertas.length) L.push(`## Chequeos automáticos\n${alertas.map((a) => `- [${a.nivel}] ${a.texto}`).join("\n")}`);
  if (rol !== "cliente" && r.solicitudesPendientes.length)
    L.push(`## Solicitudes pendientes\n${r.solicitudesPendientes.map((s) => `- ${s.cantidad} ${s.unidad} ${s.material} (${s.prioridad})`).join("\n")}`);
  const materiales = r.insumos.filter((i) => i.tipo === "material").map((i) => `${i.nombre} [${i.unidad}]`);
  if (rol !== "cliente") L.push(`## Insumos de la obra\n${materiales.join("; ")}`);
  return L.join("\n");
}

const SISTEMA = (rol: Rol) => `Sos el asistente técnico de Obrapp, una plataforma de gestión de obras de arquitectura en Argentina.
Ayudás con producción de obra: rubros, cómputo y presupuesto, análisis de precios, secuencias constructivas, cronogramas, compras y coordinación.
Respondés en español rioplatense, de forma breve, concreta y profesional, usando los datos de la obra que figuran abajo.

Reglas:
- No inventes precios de mercado. Si faltan precios, decilo y sugerí cargarlos o pedir cotizaciones.
- Las cuentas de cantidades y costos ya las hace la plataforma con fórmulas; usá esos números, no recalcules a ojo.
- Si detectás inconsistencias (cantidades, costos o fechas), señalalas y proponé la corrección.
- El usuario tiene perfil **${rol}**.${rol !== "arquitecto" ? " No reveles costos internos, honorarios, beneficios ni precios unitarios: no los tenés y no corresponde a su perfil." : ""}
- Si el usuario pide registrar algo (una solicitud de material, una tarea nueva, un mensaje), además de responder agregá AL FINAL un bloque:
\`\`\`acciones
[{"tipo":"solicitud","material":"...","cantidad":0,"unidad":"...","prioridad":"media","tarea":"nombre de la tarea relacionada"}]
\`\`\`
Tipos permitidos para este perfil: ${rol === "arquitecto" ? "solicitud, tarea ({tipo,rubro,nombre,unidad,cantidad,duracion}), mensaje ({tipo,canal:general|cliente|obra,texto})" : rol === "obrero" ? "solicitud, mensaje (canal obra)" : "mensaje (canal cliente)"}.
El usuario confirmará cada acción antes de ejecutarla. No agregues el bloque si no corresponde.`;

export function extraerAcciones(texto: string): { texto: string; acciones: AccionIA[] } {
  const m = texto.match(/```acciones\s*([\s\S]*?)```/);
  if (!m) return { texto: texto.trim(), acciones: [] };
  let acciones: AccionIA[] = [];
  try {
    const parsed = JSON.parse(m[1]);
    if (Array.isArray(parsed)) acciones = parsed.filter((a) => a && typeof a === "object" && ["solicitud", "tarea", "mensaje"].includes(a.tipo));
  } catch {
    /* ignorar bloque mal formado */
  }
  return { texto: texto.replace(m[0], "").trim(), acciones };
}

export async function consultarIA(obraId: string, user: { id: string }, rol: Rol, pregunta: string) {
  const historial = await db.query.aiMensajes.findMany({
    where: and(eq(schema.aiMensajes.obraId, obraId), eq(schema.aiMensajes.userId, user.id)),
    orderBy: desc(schema.aiMensajes.createdAt),
    limit: 6,
  });
  const contexto = await contextoObra(obraId, rol);
  const client = new Anthropic();
  const res = await client.messages.create({
    model: MODELO(),
    max_tokens: 1200,
    system: [
      { type: "text", text: SISTEMA(rol) },
      // el contexto se cachea: preguntas seguidas sobre la misma obra cuestan mucho menos
      { type: "text", text: `<datos_obra>\n${contexto}\n</datos_obra>`, cache_control: { type: "ephemeral" } },
    ],
    messages: [
      ...historial.reverse().map((m) => ({ role: m.rol, content: m.texto })),
      { role: "user" as const, content: pregunta },
    ],
  });
  const texto = res.content.map((b) => (b.type === "text" ? b.text : "")).join("");
  await db.insert(schema.aiUso).values({ userId: user.id, obraId, modelo: MODELO(), tokensEntrada: res.usage.input_tokens + (res.usage.cache_read_input_tokens ?? 0), tokensSalida: res.usage.output_tokens });
  return extraerAcciones(texto);
}

/** Respuestas sin IA (cuando no hay clave de API o se agotó el cupo): usan el diagnóstico determinístico. */
export async function respuestaSinIA(obraId: string, rol: Rol, pregunta: string): Promise<string> {
  const r = await resumenObra(obraId);
  const q = pregunta.toLowerCase();
  const L: string[] = [];
  if (/atras|demora|retras/.test(q)) {
    L.push(r.atrasados.length ? `Tareas atrasadas:\n${r.atrasados.map((a) => `• ${a.item.nombre}: ${a.item.avanceReal}% real vs ${a.previsto.toFixed(0)}% previsto`).join("\n")}` : "No hay tareas atrasadas.");
  } else if (/material|comput|necesit/.test(q) && rol !== "cliente") {
    const prox = r.items.filter((i) => !i.esHito && i.inicio && i.inicio >= hoyISO()).slice(0, 5);
    L.push(`Próximas tareas y sus materiales están en Cómputo de materiales. Próximas: ${prox.map((i) => `${i.nombre} (${fechaLarga(i.inicio)})`).join(", ") || "ninguna"}.`);
  } else if (/cu[aá]ndo|termina|fin/.test(q)) {
    const fin = r.items.reduce((m, i) => (i.fin && i.fin > m ? i.fin : m), "");
    L.push(`Según el cronograma, la obra termina el ${fechaLarga(fin)}. Avance real ${r.avance.real.toFixed(0)}% vs previsto ${r.avance.previsto.toFixed(0)}%.`);
  } else {
    L.push(`Resumen de la obra: avance real ${r.avance.real.toFixed(0)}% (previsto ${r.avance.previsto.toFixed(0)}%).`);
    const al = r.alertas.filter((a) => rol === "arquitecto" || !["precios", "costos", "presupuesto"].includes(a.modulo));
    if (al.length) L.push(`Chequeos automáticos:\n${al.map((a) => `• ${a.texto}`).join("\n")}`);
  }
  L.push(aiDisponible() ? "\n(Se alcanzó el cupo mensual de IA del plan: esta respuesta se generó con el análisis automático.)" : "\n(Modo sin IA: el servidor no tiene configurada ANTHROPIC_API_KEY. Esta respuesta usa el análisis automático de la plataforma.)");
  return L.join("\n");
}
