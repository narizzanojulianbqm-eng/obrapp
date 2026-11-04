"use server";
import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, schema } from "@/lib/db";
import { assertObra, auditar, notificar } from "@/lib/access";
import type { AccionIA } from "@/lib/ai";
import { recalcularObra } from "@/lib/obra-service";
import { puedeCanal } from "@/lib/canales";

/** Asistente web: usa el MISMO motor de conversación que WhatsApp (mismas consultas, acciones y confirmaciones). */
export async function preguntarIA(obraId: string, pregunta: string) {
  const { user } = await assertObra(obraId);
  const q = pregunta.trim().slice(0, 4000);
  if (!q) return;
  await db.insert(schema.aiMensajes).values({ obraId, userId: user.id, rol: "user", texto: q });
  const { procesar } = await import("@/lib/asistente/motor");
  const salida = await procesar({ userId: user.id, canal: "web", texto: q, obraId });
  const texto = salida.respuestas.map((r) => r.texto).join("\n\n");
  const media = salida.respuestas.flatMap((r) => r.media ?? []);
  await db.insert(schema.aiMensajes).values({ obraId, userId: user.id, rol: "assistant", texto, acciones: media.length ? [{ tipo: "media", ids: media }] : null });
  revalidatePath(`/obras/${obraId}/asistente`);
}

export async function borrarHistorialIA(obraId: string) {
  const { user } = await assertObra(obraId);
  await db.delete(schema.aiMensajes).where(and(eq(schema.aiMensajes.obraId, obraId), eq(schema.aiMensajes.userId, user.id)));
  revalidatePath(`/obras/${obraId}/asistente`);
}

/** Ejecuta una acción propuesta por la IA, solo tras la confirmación del usuario y con sus permisos. */
export async function ejecutarAccionIA(obraId: string, accion: AccionIA) {
  const { user, rol } = await assertObra(obraId);
  if (accion.tipo === "solicitud") {
    if (rol === "cliente") throw new Error("Tu perfil no puede crear solicitudes de materiales");
    const items = await db.query.items.findMany({ where: eq(schema.items.obraId, obraId) });
    const it = accion.tarea ? items.find((i) => i.nombre.toLowerCase().includes(accion.tarea!.toLowerCase())) : undefined;
    const ins = await db.query.insumos.findFirst({ where: and(eq(schema.insumos.obraId, obraId), eq(schema.insumos.nombre, accion.material)) });
    await db.insert(schema.solicitudes).values({
      obraId,
      solicitanteId: user.id,
      material: String(accion.material).slice(0, 200),
      cantidad: Math.max(0.01, Number(accion.cantidad) || 1),
      unidad: String(accion.unidad || "u").slice(0, 20),
      prioridad: ["baja", "media", "alta", "urgente"].includes(accion.prioridad ?? "") ? accion.prioridad! : "media",
      itemId: it?.id ?? null,
      insumoId: ins?.id ?? null,
      observaciones: accion.observaciones ?? "Creada desde el asistente",
    });
    await notificar(obraId, ["arquitecto"], `${user.nombre} solicitó ${accion.cantidad} ${accion.unidad} de ${accion.material}`, `/obras/${obraId}/solicitudes`, user.id);
  } else if (accion.tipo === "tarea") {
    if (rol !== "arquitecto") throw new Error("Solo el arquitecto puede crear tareas");
    let rubro = await db.query.rubros.findFirst({ where: and(eq(schema.rubros.obraId, obraId), eq(schema.rubros.nombre, accion.rubro)) });
    if (!rubro) {
      const [{ m }] = await db.select({ m: sql<number>`coalesce(max(orden),0)` }).from(schema.rubros).where(eq(schema.rubros.obraId, obraId));
      [rubro] = await db.insert(schema.rubros).values({ obraId, nombre: accion.rubro || "Varios", orden: Number(m) + 1, codigo: String(Number(m) + 1).padStart(2, "0") }).returning();
    }
    const ultimo = await db.query.items.findFirst({ where: eq(schema.items.rubroId, rubro.id), orderBy: (t, { desc }) => desc(t.orden) });
    await db.insert(schema.items).values({
      obraId,
      rubroId: rubro.id,
      orden: (ultimo?.orden ?? 0) + 1,
      nombre: accion.nombre,
      unidad: accion.unidad || "gl",
      cantidadManual: Number(accion.cantidad) || 1,
      duracionManual: accion.duracion ? Math.max(1, Math.round(accion.duracion)) : null,
      predecesoras: ultimo ? [{ id: ultimo.id, tipo: "FC", desfase: 0 }] : [],
    });
    await recalcularObra(obraId);
  } else if (accion.tipo === "mensaje") {
    if (!puedeCanal(rol, accion.canal)) throw new Error("No tenés acceso a ese canal");
    await db.insert(schema.mensajes).values({ obraId, canal: accion.canal, autorId: user.id, texto: accion.texto });
    await notificar(obraId, rol === "arquitecto" ? (accion.canal === "cliente" ? ["cliente"] : accion.canal === "obra" ? ["obrero"] : ["cliente", "obrero"]) : ["arquitecto"], `${user.nombre}: ${accion.texto.slice(0, 80)}`, `/obras/${obraId}/mensajes?canal=${accion.canal}`, user.id);
  }
  await auditar(obraId, user.id, `ia.accion.${accion.tipo}`, JSON.stringify(accion).slice(0, 300));
  revalidatePath(`/obras/${obraId}`, "layout");
}
