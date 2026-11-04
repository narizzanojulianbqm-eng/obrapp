import "server-only";
import crypto from "node:crypto";
import { waConfig } from "./config";

/** Cliente mínimo de la WhatsApp Cloud API (Graph API de Meta). Sin dependencias no oficiales. */
const base = () => `https://graph.facebook.com/${waConfig().version}`;
const headers = () => ({ Authorization: `Bearer ${waConfig().token}`, "Content-Type": "application/json" });

async function post(path: string, body: unknown) {
  const r = await fetch(`${base()}/${path}`, { method: "POST", headers: headers(), body: JSON.stringify(body) });
  const j = (await r.json().catch(() => ({}))) as { messages?: { id: string }[]; error?: { message: string; code: number }; id?: string };
  if (!r.ok) throw new Error(`WhatsApp API ${r.status}: ${j.error?.message ?? "error"} (${j.error?.code ?? ""})`);
  return j;
}

export async function enviarTexto(to: string, texto: string) {
  const j = await post(`${waConfig().phoneNumberId}/messages`, { messaging_product: "whatsapp", to, type: "text", text: { body: texto.slice(0, 4096), preview_url: true } });
  return j.messages?.[0]?.id;
}

export async function enviarPlantilla(to: string, nombre: string, parametros: string[]) {
  const j = await post(`${waConfig().phoneNumberId}/messages`, {
    messaging_product: "whatsapp",
    to,
    type: "template",
    template: { name: nombre, language: { code: waConfig().idioma }, components: parametros.length ? [{ type: "body", parameters: parametros.map((t) => ({ type: "text", text: t.slice(0, 1000) })) }] : [] },
  });
  return j.messages?.[0]?.id;
}

export async function subirMedia(buf: Buffer, mime: string, nombre: string) {
  const fd = new FormData();
  fd.append("messaging_product", "whatsapp");
  fd.append("file", new Blob([new Uint8Array(buf)], { type: mime }), nombre);
  const r = await fetch(`${base()}/${waConfig().phoneNumberId}/media`, { method: "POST", headers: { Authorization: `Bearer ${waConfig().token}` }, body: fd });
  const j = (await r.json()) as { id?: string; error?: { message: string } };
  if (!r.ok || !j.id) throw new Error(`Subida de media: ${j.error?.message ?? r.status}`);
  return j.id;
}

export async function enviarMedia(to: string, tipo: "image" | "document" | "audio" | "video", mediaId: string, caption?: string, filename?: string) {
  const obj: Record<string, string> = { id: mediaId };
  if (caption && tipo !== "audio") obj.caption = caption;
  if (filename && tipo === "document") obj.filename = filename;
  const j = await post(`${waConfig().phoneNumberId}/messages`, { messaging_product: "whatsapp", to, type: tipo, [tipo]: obj });
  return j.messages?.[0]?.id;
}

export async function marcarLeido(messageId: string) {
  await post(`${waConfig().phoneNumberId}/messages`, { messaging_product: "whatsapp", status: "read", message_id: messageId }).catch(() => undefined);
}

/** Descarga un archivo recibido: primero se obtiene la URL temporal y luego el binario (ambos con el token). */
export async function descargarMedia(mediaId: string): Promise<{ buf: Buffer; mime: string }> {
  const r = await fetch(`${base()}/${mediaId}`, { headers: headers() });
  const j = (await r.json()) as { url?: string; mime_type?: string };
  if (!j.url) throw new Error("No se pudo obtener la URL del archivo");
  const f = await fetch(j.url, { headers: { Authorization: `Bearer ${waConfig().token}` } });
  return { buf: Buffer.from(await f.arrayBuffer()), mime: j.mime_type ?? f.headers.get("content-type") ?? "application/octet-stream" };
}

/** Valida la firma HMAC-SHA256 que Meta envía en cada webhook. */
export function firmaValida(rawBody: string, firma: string | null): boolean {
  const secret = waConfig().appSecret;
  if (!secret) return process.env.NODE_ENV !== "production"; // en producción la firma es obligatoria
  if (!firma?.startsWith("sha256=")) return false;
  const esperada = crypto.createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  const a = Buffer.from(firma.slice(7), "hex"), b = Buffer.from(esperada, "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** Mensaje interactivo: hasta 3 botones de respuesta rápida, o una lista de hasta 10 opciones. Solo dentro de la ventana de 24 h. */
export async function enviarInteractivo(to: string, texto: string, opciones: { id: string; titulo: string }[]) {
  const body = texto.slice(0, 1024);
  const interactive =
    opciones.length <= 3
      ? { type: "button", body: { text: body }, action: { buttons: opciones.map((o) => ({ type: "reply", reply: { id: o.id, title: o.titulo.slice(0, 20) } })) } }
      : { type: "list", body: { text: body }, action: { button: "Elegir", sections: [{ title: "Opciones", rows: opciones.slice(0, 10).map((o) => ({ id: o.id, title: o.titulo.slice(0, 24) })) }] } };
  const j = await post(`${waConfig().phoneNumberId}/messages`, { messaging_product: "whatsapp", to, type: "interactive", interactive });
  return j.messages?.[0]?.id;
}
