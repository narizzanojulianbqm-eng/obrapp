import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { db, schema } from "../db";
import type { FilaImportada } from "./texto";
import { normalizarUnidad } from "./texto";

const modelo = () => process.env.AI_MODEL || "claude-haiku-5-5";

const HERRAMIENTA = {
  name: "cargar_items",
  description: "Devuelve los rubros e ítems de obra encontrados en el documento.",
  input_schema: {
    type: "object" as const,
    properties: {
      items: {
        type: "array",
        items: {
          type: "object",
          properties: {
            rubro: { type: "string", description: "Rubro o capítulo al que pertenece (ej. Albañilería)" },
            nombre: { type: "string", description: "Descripción de la tarea tal como aparece" },
            unidad: { type: "string", description: "m2, m3, ml, u, gl, kg, boca, local…" },
            cantidad: { type: "number" },
            precio_unitario: { type: ["number", "null"], description: "Precio unitario en pesos, si figura" },
          },
          required: ["rubro", "nombre", "unidad", "cantidad"],
        },
      },
      nota: { type: "string", description: "Algo que el arquitecto debería revisar (opcional)" },
    },
    required: ["items"],
  },
};

const INSTRUCCION = `Sos un asistente de un estudio de arquitectura argentino. Del documento adjunto (presupuesto, cómputo, planilla o lista de tareas de obra) extraé TODAS las tareas con su rubro, unidad, cantidad y precio unitario si figura. No inventes ítems ni cantidades: si una cantidad no figura, poné 0. Ignorá subtotales, totales, IVA, honorarios y datos del cliente. Si es un plano, devolvé solo lo que se pueda medir con certeza (superficies indicadas, cantidades rotuladas). Respondé solo con la herramienta cargar_items.`;

/** Lee un archivo (foto, PDF escaneado) o un texto desordenado con IA. Lo paga la plataforma: se registra en ai_uso. */
export async function leerConIA(entrada: { archivo?: File; texto?: string }, userId: string, obraId: string): Promise<{ filas: FilaImportada[]; nota?: string }> {
  const client = new Anthropic();
  const content: Anthropic.ContentBlockParam[] = [];
  if (entrada.archivo) {
    const data = Buffer.from(await entrada.archivo.arrayBuffer()).toString("base64");
    const mt = entrada.archivo.type;
    if (mt === "application/pdf" || /\.pdf$/i.test(entrada.archivo.name)) content.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data } });
    else content.push({ type: "image", source: { type: "base64", media_type: (["image/png", "image/jpeg", "image/webp", "image/gif"].includes(mt) ? mt : "image/jpeg") as "image/png", data } });
  }
  if (entrada.texto) content.push({ type: "text", text: `Texto del documento:\n${entrada.texto.slice(0, 60000)}` });
  content.push({ type: "text", text: INSTRUCCION });
  const res = await client.messages.create({ model: modelo(), max_tokens: 8000, tools: [HERRAMIENTA], tool_choice: { type: "tool", name: "cargar_items" }, messages: [{ role: "user", content }] });
  await db.insert(schema.aiUso).values({ userId, obraId, modelo: modelo(), tokensEntrada: res.usage.input_tokens, tokensSalida: res.usage.output_tokens });
  const uso = res.content.find((b) => b.type === "tool_use");
  const inp = (uso?.type === "tool_use" ? uso.input : { items: [] }) as { items: { rubro: string; nombre: string; unidad: string; cantidad: number; precio_unitario?: number | null }[]; nota?: string };
  const filas = (inp.items ?? []).filter((i) => i?.nombre).slice(0, 500).map((i) => ({
    rubro: String(i.rubro || "Varios").slice(0, 120),
    nombre: String(i.nombre).slice(0, 200),
    unidad: normalizarUnidad(String(i.unidad ?? "")) ?? (String(i.unidad || "gl").slice(0, 20)),
    cantidad: Math.max(0, Number(i.cantidad) || 0),
    precio: i.precio_unitario && i.precio_unitario > 0 ? Number(i.precio_unitario) : null,
    duracion: null,
  }));
  return { filas, nota: inp.nota };
}
