import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { aiDisponible } from "../ai";

/** Transcripción de audios. Proveedor intercambiable; hoy: OpenAI (gpt-4o-mini-transcribe / whisper). */
export async function transcribirAudio(buf: Buffer, mime: string): Promise<string | null> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  const fd = new FormData();
  const ext = mime.includes("ogg") ? "ogg" : mime.includes("mpeg") ? "mp3" : mime.includes("mp4") ? "m4a" : "ogg";
  fd.append("file", new Blob([new Uint8Array(buf)], { type: mime }), `audio.${ext}`);
  fd.append("model", process.env.TRANSCRIPTION_MODEL ?? "gpt-4o-mini-transcribe");
  fd.append("language", "es");
  try {
    const r = await fetch("https://api.openai.com/v1/audio/transcriptions", { method: "POST", headers: { Authorization: `Bearer ${key}` }, body: fd });
    if (!r.ok) return null;
    const j = (await r.json()) as { text?: string };
    return j.text?.trim() || null;
  } catch {
    return null;
  }
}

/** Descripción técnica breve de una foto de obra (visión de Claude). */
export async function describirImagen(buf: Buffer, mime: string, contexto: string): Promise<string | null> {
  if (!aiDisponible() || !/image\/(jpeg|png|webp|gif)/.test(mime)) return null;
  try {
    const client = new Anthropic();
    const r = await client.messages.create({
      model: process.env.AI_MODEL || "claude-haiku-5-5",
      max_tokens: 250,
      messages: [{
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mime as "image/jpeg", data: buf.toString("base64") } },
          { type: "text", text: `Foto enviada desde una obra. Contexto: ${contexto}. Describí en 1-2 oraciones, en español técnico de obra, qué trabajo se ve y su estado aparente. Si ves un posible problema constructivo, mencionalo. No inventes.` },
        ],
      }],
    });
    return r.content.map((b) => (b.type === "text" ? b.text : "")).join("").trim() || null;
  } catch {
    return null;
  }
}
