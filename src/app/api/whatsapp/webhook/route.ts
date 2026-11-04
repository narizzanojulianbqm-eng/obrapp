import { after } from "next/server";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { waConfig } from "@/lib/whatsapp/config";
import { descargarMedia, firmaValida, marcarLeido } from "@/lib/whatsapp/cloud";
import { procesarEntrante, type MensajeEntrante } from "@/lib/whatsapp/entrada";

/** Verificación del webhook (Meta envía hub.challenge al configurarlo). */
export async function GET(req: Request) {
  const u = new URL(req.url);
  const ok = u.searchParams.get("hub.mode") === "subscribe" && waConfig().verifyToken && u.searchParams.get("hub.verify_token") === waConfig().verifyToken;
  return ok ? new Response(u.searchParams.get("hub.challenge") ?? "", { status: 200 }) : new Response("Forbidden", { status: 403 });
}

type WaMsg = {
  from: string; id: string; type: string;
  text?: { body: string };
  image?: { id: string; mime_type: string; caption?: string };
  audio?: { id: string; mime_type: string };
  video?: { id: string; mime_type: string; caption?: string };
  document?: { id: string; mime_type: string; filename?: string; caption?: string };
  interactive?: { button_reply?: { id: string; title: string }; list_reply?: { id: string; title: string } };
  button?: { text: string };
};

/** Recepción de mensajes y estados. Responde 200 de inmediato y procesa después (Meta reintenta si tarda). */
export async function POST(req: Request) {
  const raw = await req.text();
  if (!firmaValida(raw, req.headers.get("x-hub-signature-256"))) return new Response("Firma inválida", { status: 401 });
  let body: { entry?: { changes?: { value?: { messages?: WaMsg[]; contacts?: { wa_id: string; profile?: { name?: string } }[]; statuses?: { id: string; status: string; errors?: { title: string }[] }[] } }[] }[] };
  try { body = JSON.parse(raw); } catch { return new Response("JSON inválido", { status: 400 }); }

  after(async () => {
    for (const e of body.entry ?? []) for (const ch of e.changes ?? []) {
      const v = ch.value ?? {};
      for (const s of v.statuses ?? []) {
        await db.update(schema.waMensajes).set({ estado: s.status, error: s.errors?.[0]?.title ?? null }).where(eq(schema.waMensajes.waMessageId, s.id));
      }
      for (const m of v.messages ?? []) {
        const nombre = v.contacts?.find((c) => c.wa_id === m.from)?.profile?.name;
        const entrada: MensajeEntrante = { telefono: m.from, nombrePerfil: nombre, waMessageId: m.id, tipo: "otro" };
        try {
          if (m.type === "text") Object.assign(entrada, { tipo: "text", texto: m.text?.body });
          else if (m.type === "interactive") {
            const rep = m.interactive?.button_reply ?? m.interactive?.list_reply;
            // el id de cada opción es el texto que el motor espera ("1", "si", "70%"…)
            Object.assign(entrada, { tipo: "interactive", texto: rep?.id?.startsWith("op:") ? rep.id.slice(3) : rep?.title });
          }
          else if (m.type === "button") Object.assign(entrada, { tipo: "button", texto: m.button?.text });
          else if (m.type === "image" || m.type === "audio" || m.type === "video" || m.type === "document") {
            const meta = m[m.type]!;
            const { buf, mime } = await descargarMedia(meta.id);
            const ext = mime.split("/")[1]?.split(";")[0] ?? "bin";
            Object.assign(entrada, {
              tipo: m.type,
              texto: "caption" in meta ? meta.caption : undefined,
              media: { buf, mime, nombre: (m.type === "document" && "filename" in meta && meta.filename) || `whatsapp-${m.id.slice(-8)}.${ext}` },
            });
          }
          await marcarLeido(m.id);
          await procesarEntrante(entrada);
        } catch (err) {
          console.error("Webhook WhatsApp", err);
        }
      }
    }
  });
  return new Response("OK", { status: 200 });
}
