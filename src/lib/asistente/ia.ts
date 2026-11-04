import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { db, schema } from "../db";
import type { Rol } from "../db/schema";
import { contextoObra } from "../ai";
import { resumenObra } from "../queries";
import { hoyISO } from "../engine/calendario";

export type Interpretacion = {
  intencion: "consulta" | "avance" | "solicitud_material" | "problema" | "cambio" | "aclaracion" | "otro";
  tarea?: string;
  avancePct?: number;
  terminado?: boolean;
  materiales?: { material: string; cantidad: number; unidad: string }[];
  pregunta?: string;
};

const modelo = () => process.env.AI_MODEL || "claude-haiku-5-5";

async function registrarUso(userId: string, obraId: string, u: { input_tokens: number; output_tokens: number; cache_read_input_tokens?: number | null }) {
  await db.insert(schema.aiUso).values({ userId, obraId, modelo: modelo(), tokensEntrada: u.input_tokens + (u.cache_read_input_tokens ?? 0), tokensSalida: u.output_tokens });
}

/**
 * Clasificación de mensajes informales que las reglas no resolvieron. Devuelve una estructura (tool use)
 * que luego ejecuta el motor con las mismas validaciones y permisos. La IA no toca la base directamente.
 */
export async function interpretarConIA(c: { obraId: string; rol: Rol; user: { id: string } }, texto: string): Promise<Interpretacion | null> {
  try {
    const r = await resumenObra(c.obraId);
    const hoy = hoyISO();
    const tareas = r.items.filter((i) => !i.esHito && i.avanceReal < 100).sort((a, b) => Math.abs(Date.parse(a.inicio ?? hoy) - Date.parse(hoy)) - Math.abs(Date.parse(b.inicio ?? hoy) - Date.parse(hoy))).slice(0, 25).map((i) => i.nombre);
    const materiales = r.insumos.filter((i) => i.tipo === "material").map((i) => `${i.nombre} [${i.unidad}]`);
    const client = new Anthropic();
    const res = await client.messages.create({
      model: modelo(),
      max_tokens: 400,
      system: `Clasificás mensajes de WhatsApp de una obra en Argentina. Perfil del remitente: ${c.rol}. Distinguí: consulta (pregunta), avance (informa trabajo hecho), solicitud_material (pide materiales/herramientas), problema (imprevisto, bloqueo), cambio (el cliente pide modificar algo), aclaracion (no se entiende: formulá una pregunta corta). Usá SOLO nombres de tareas y materiales de las listas.`,
      tools: [{
        name: "clasificar",
        description: "Devuelve la interpretación estructurada del mensaje",
        input_schema: {
          type: "object",
          properties: {
            intencion: { type: "string", enum: ["consulta", "avance", "solicitud_material", "problema", "cambio", "aclaracion", "otro"] },
            tarea: { type: "string", description: "Nombre exacto de la tarea relacionada, de la lista" },
            avancePct: { type: "number", description: "Porcentaje total informado, si lo dice" },
            terminado: { type: "boolean" },
            materiales: { type: "array", items: { type: "object", properties: { material: { type: "string" }, cantidad: { type: "number" }, unidad: { type: "string" } }, required: ["material", "cantidad", "unidad"] } },
            pregunta: { type: "string", description: "Pregunta de aclaración breve, si intencion=aclaracion" },
          },
          required: ["intencion"],
        },
      }],
      tool_choice: { type: "tool", name: "clasificar" },
      messages: [{ role: "user", content: `Tareas activas: ${tareas.join(" | ")}\nMateriales: ${materiales.join(" | ")}\n\nMensaje: """${texto}"""` }],
    });
    await registrarUso(c.user.id, c.obraId, res.usage);
    const tu = res.content.find((b) => b.type === "tool_use");
    return tu && tu.type === "tool_use" ? (tu.input as Interpretacion) : null;
  } catch (e) {
    console.error("interpretarConIA", e);
    return null;
  }
}

/** Respuesta abierta con los datos de la obra como contexto (filtrados por perfil). */
export async function responderLibre(obraId: string, userId: string, rol: Rol, pregunta: string): Promise<string | null> {
  try {
    const contexto = await contextoObra(obraId, rol);
    const client = new Anthropic();
    const res = await client.messages.create({
      model: modelo(),
      max_tokens: 600,
      system: [
        { type: "text", text: `Sos el asistente de obra de Obrapp, respondiendo por WhatsApp a un usuario con perfil ${rol}. Respuestas cortas (máximo 8 líneas), en español rioplatense, con datos concretos de la obra. No inventes precios ni datos. ${rol !== "arquitecto" ? "No reveles costos internos, honorarios ni beneficios." : ""} Si no tenés el dato, decilo.` },
        { type: "text", text: `<datos_obra>\n${contexto}\n</datos_obra>`, cache_control: { type: "ephemeral" } },
      ],
      messages: [{ role: "user", content: pregunta }],
    });
    await registrarUso(userId, obraId, res.usage);
    return res.content.map((b) => (b.type === "text" ? b.text : "")).join("").trim() || null;
  } catch (e) {
    console.error("responderLibre", e);
    return null;
  }
}
