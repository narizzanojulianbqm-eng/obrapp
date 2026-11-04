import "server-only";
import { and, eq, gt } from "drizzle-orm";
import { db, schema } from "../db";
import { auditar } from "../access";
import { procesar, type Medio } from "../asistente/motor";
import { enviarAContacto } from "./enviar";
import { transcribirAudio } from "./medios";
import { normalizar } from "../asistente/texto";

export type MensajeEntrante = {
  telefono: string; // wa_id del remitente (ya normalizado por Meta)
  nombrePerfil?: string;
  waMessageId?: string;
  tipo: "text" | "audio" | "image" | "video" | "document" | "interactive" | "button" | "otro";
  texto?: string;
  media?: { buf: Buffer; mime: string; nombre: string };
  simulado?: boolean;
};

/** Procesa un mensaje entrante de WhatsApp: identifica al usuario, registra el historial y responde. */
export async function procesarEntrante(m: MensajeEntrante) {
  // Idempotencia: Meta puede reenviar el mismo webhook
  if (m.waMessageId) {
    const ya = await db.query.waMensajes.findFirst({ where: eq(schema.waMensajes.waMessageId, m.waMessageId) });
    if (ya) return;
  }
  let c = await db.query.waContactos.findFirst({ where: eq(schema.waContactos.telefono, m.telefono) });
  if (!c) [c] = await db.insert(schema.waContactos).values({ telefono: m.telefono, nombre: m.nombrePerfil ?? null, estado: "invitado" }).returning();
  await db.update(schema.waContactos).set({ ultimoEntrante: new Date(), nombre: c.nombre ?? m.nombrePerfil ?? null }).where(eq(schema.waContactos.id, c.id));
  c.ultimoEntrante = new Date();

  // Transcripción de audio
  let texto = (m.texto ?? "").trim();
  let transcripcion: string | null = null;
  if (m.tipo === "audio" && m.media) {
    transcripcion = await transcribirAudio(m.media.buf, m.media.mime);
    if (transcripcion) texto = [texto, transcripcion].filter(Boolean).join(" ");
  }
  const [log] = await db
    .insert(schema.waMensajes)
    .values({ contactoId: c.id, direccion: "entrante", tipo: m.tipo, texto: m.texto ?? null, transcripcion, waMessageId: m.waMessageId ?? null, estado: m.simulado ? "simulado" : "recibido" })
    .returning();

  if (c.estado === "bloqueado") {
    await db.update(schema.waMensajes).set({ intencion: "bloqueado", estado: "procesado" }).where(eq(schema.waMensajes.id, log.id));
    return;
  }

  // Vinculación por código (usuarios registrados en la web que agregan su número)
  const vinc = normalizar(texto).match(/^vincular\s+(\d{6})$/);
  if (vinc) {
    const ok = await db.query.waContactos.findFirst({
      where: and(eq(schema.waContactos.telefono, m.telefono), eq(schema.waContactos.codigoVinculacion, vinc[1]), gt(schema.waContactos.codigoExpira, new Date())),
    });
    if (ok?.userId) {
      await db.update(schema.waContactos).set({ estado: "activo", codigoVinculacion: null, codigoExpira: null }).where(eq(schema.waContactos.id, c.id));
      await auditar(null, ok.userId, "whatsapp.vincular", m.telefono);
      await enviarAContacto(c, null, { texto: "✅ Tu número quedó vinculado a tu cuenta de Obrapp. Escribí *ayuda* para ver qué podés hacer." });
    } else {
      await enviarAContacto(c, null, { texto: "El código no es válido o venció. Generá uno nuevo desde Configuración → WhatsApp en la web." });
    }
    return;
  }

  // Número desconocido: no se revela ninguna información
  if (!c.userId) {
    await db.update(schema.waMensajes).set({ intencion: "numero_no_vinculado", estado: m.simulado ? "simulado" : "procesado" }).where(eq(schema.waMensajes.id, log.id));
    await enviarAContacto(c, null, { texto: "Hola 👋 Este número no está vinculado a ninguna obra en Obrapp. Pedile al arquitecto de tu obra que te sume con este número, o vinculalo desde la web (Configuración → WhatsApp)." });
    return;
  }

  // Primer mensaje de un número invitado por el arquitecto: el remitente demuestra ser el titular de la línea
  if (c.estado === "invitado") {
    await db.update(schema.waContactos).set({ estado: "activo" }).where(eq(schema.waContactos.id, c.id));
    await auditar(null, c.userId, "whatsapp.activar", m.telefono);
    c.estado = "activo";
  }

  const medios: Medio[] = [];
  if (m.media && m.tipo !== "text") {
    const tipo = m.tipo === "image" ? "image" : m.tipo === "audio" ? "audio" : m.tipo === "video" ? "video" : "document";
    medios.push({ ...m.media, tipo, transcripcion });
  }
  try {
    const salida = await procesar({ userId: c.userId, canal: "whatsapp", texto, medios, contactoId: c.id });
    await db.update(schema.waMensajes).set({ intencion: salida.intencion, obraId: salida.obraId, estado: m.simulado ? "simulado" : "procesado" }).where(eq(schema.waMensajes.id, log.id));
    const fresco = (await db.query.waContactos.findFirst({ where: eq(schema.waContactos.id, c.id) }))!;
    // Un solo mensaje por respuesta (cada mensaje saliente tiene costo en WhatsApp)
    const textoSalida = salida.respuestas.map((r) => r.texto).filter(Boolean).join("\n\n");
    const media = salida.respuestas.flatMap((r) => r.media ?? []).slice(0, 4);
    const opciones = [...salida.respuestas].reverse().find((r) => r.opciones?.length)?.opciones;
    await enviarAContacto(fresco, salida.obraId, { texto: textoSalida, media, opciones });
  } catch (e) {
    console.error("WhatsApp procesar", e);
    await db.update(schema.waMensajes).set({ estado: "error", error: e instanceof Error ? e.message : String(e) }).where(eq(schema.waMensajes.id, log.id));
    await enviarAContacto(c, null, { texto: "Tuve un problema procesando tu mensaje. Ya quedó registrado; probá de nuevo en un rato o escribile al arquitecto." });
  }
}
