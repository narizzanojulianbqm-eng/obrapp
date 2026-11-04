import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { db, schema } from "../db";
import { leerArchivo } from "../files";
import { waActivo, waConfig } from "./config";
import * as cloud from "./cloud";

type Contacto = typeof schema.waContactos.$inferSelect;
const VENTANA_MS = 24 * 60 * 60 * 1000;

/** WhatsApp permite mensajes libres solo dentro de las 24 h posteriores al último mensaje del usuario. */
export const ventanaAbierta = (c: Contacto) => !!c.ultimoEntrante && Date.now() - c.ultimoEntrante.getTime() < VENTANA_MS;

async function registrar(c: Contacto, obraId: string | null, tipo: string, texto: string | null, extra: Partial<typeof schema.waMensajes.$inferInsert> = {}) {
  await db.insert(schema.waMensajes).values({ contactoId: c.id, obraId, direccion: "saliente", tipo, texto, ...extra });
}

/**
 * Envía una respuesta a un contacto. Si la ventana de 24 h está cerrada usa la plantilla aprobada de aviso.
 * Sin credenciales, el mensaje queda registrado como "simulado" (lo ve el simulador).
 */
export async function enviarAContacto(c: Contacto, obraId: string | null, salida: { texto: string; media?: string[]; opciones?: { id: string; titulo: string }[] }) {
  const activo = waActivo();
  const abierta = ventanaAbierta(c);
  try {
    const ops = salida.opciones?.length ? salida.opciones.slice(0, 10) : undefined;
    if (!activo) {
      await registrar(c, obraId, ops ? "interactive" : "text", salida.texto, { estado: "simulado", opciones: ops ?? null });
      for (const m of salida.media ?? []) await registrar(c, obraId, "image", null, { estado: "simulado", mediaDocId: m });
      return;
    }
    if (!abierta) {
      const id = await cloud.enviarPlantilla(c.telefono, waConfig().plantillaAviso, [c.nombre ?? "", salida.texto.replace(/\n+/g, " · ").slice(0, 900)]);
      await registrar(c, obraId, "template", salida.texto, { estado: "enviado", waMessageId: id });
      return; // fuera de ventana no se pueden mandar imágenes libres
    }
    if (ops && salida.texto.length <= 1024) {
      const id = await cloud.enviarInteractivo(c.telefono, salida.texto, ops);
      await registrar(c, obraId, "interactive", salida.texto, { estado: "enviado", waMessageId: id, opciones: ops });
    } else {
      const id = await cloud.enviarTexto(c.telefono, salida.texto);
      await registrar(c, obraId, "text", salida.texto, { estado: "enviado", waMessageId: id });
    }
    for (const docId of salida.media ?? []) {
      const d = await db.query.documentos.findFirst({ where: eq(schema.documentos.id, docId) });
      if (!d) continue;
      const buf = await leerArchivo(d);
      if (!buf) continue;
      const mediaId = await cloud.subirMedia(buf, d.mime ?? "image/jpeg", d.nombre);
      const mid = await cloud.enviarMedia(c.telefono, d.mime?.startsWith("image/") ? "image" : "document", mediaId, undefined, d.nombre);
      await registrar(c, obraId, "image", null, { estado: "enviado", mediaDocId: docId, waMessageId: mid });
    }
  } catch (e) {
    await registrar(c, obraId, "text", salida.texto, { estado: "error", error: e instanceof Error ? e.message : String(e) });
  }
}

export async function enviarBienvenida(c: Contacto, obraNombre: string, rol: string) {
  const texto =
    `¡Hola${c.nombre ? ` ${c.nombre.split(" ")[0]}` : ""}! Bienvenido/a a la obra *${obraNombre}* en Obrapp.\n` +
    (rol === "obrero"
      ? "Podés mandarme mensajes, audios o fotos para registrar avances, consultar tus tareas o pedir materiales."
      : rol === "cliente"
        ? "Podés preguntarme cómo viene la obra, cuánto falta, qué decisiones tenés pendientes o pedir fotos de los avances."
        : "Podés consultarme atrasos, gastos, materiales, pendientes de aprobación o pedirme informes de tus obras.") +
    "\nNo necesitás descargar ninguna aplicación. Respondé este mensaje para activar el canal.";
  if (waActivo()) {
    try {
      const id = await cloud.enviarPlantilla(c.telefono, waConfig().plantillaBienvenida, [c.nombre ?? "", obraNombre]);
      await registrar(c, null, "template", texto, { estado: "enviado", waMessageId: id });
    } catch (e) {
      await registrar(c, null, "template", texto, { estado: "error", error: e instanceof Error ? e.message : String(e) });
    }
  } else {
    await registrar(c, null, "template", texto, { estado: "simulado" });
  }
}

/** Reenvía notificaciones de la plataforma a quienes tienen WhatsApp vinculado (canal configurado del usuario). */
export async function notificarPorWhatsApp(userIds: string[], obraId: string | null, texto: string, link?: string | null) {
  if (!userIds.length) return;
  const cs = await db.query.waContactos.findMany({ where: and(inArray(schema.waContactos.userId, userIds), eq(schema.waContactos.estado, "activo"), eq(schema.waContactos.notificaciones, true)) });
  for (const c of cs) await enviarAContacto(c, obraId, { texto: `🔔 ${texto}${link ? `\n${waConfig().appUrl}${link}` : ""}` });
}
