import "server-only";
import { db, schema } from "./db";

/**
 * Envío de emails transaccionales. Proveedor: Resend (API HTTP, sin dependencias).
 * Sin RESEND_API_KEY el email no sale: queda registrado en la auditoría como "simulado" para poder verificar el flujo.
 */
export const emailActivo = () => !!process.env.RESEND_API_KEY;
const esFicticio = (to: string) => to.endsWith(".obrapp.local") || !to.includes("@");

export async function enviarEmail({ to, asunto, texto, link, linkTexto }: { to: string; asunto: string; texto: string; link?: string; linkTexto?: string }) {
  if (esFicticio(to)) return { ok: false, simulado: true };
  const html = `<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:560px;margin:0 auto;color:#18181b">
  <div style="font-weight:600;font-size:15px;margin-bottom:16px"><span style="display:inline-block;background:#254f42;color:#fff;border-radius:6px;padding:2px 8px;margin-right:6px">O</span>Obrapp</div>
  <div style="font-size:14px;line-height:1.6;white-space:pre-wrap">${escapar(texto)}</div>
  ${link ? `<p style="margin:24px 0"><a href="${link}" style="background:#254f42;color:#fff;text-decoration:none;padding:10px 16px;border-radius:8px;font-size:14px">${escapar(linkTexto ?? "Abrir")}</a></p><p style="font-size:12px;color:#71717a">Si el botón no funciona, copiá este link: ${link}</p>` : ""}
  <p style="font-size:12px;color:#a1a1aa;margin-top:32px">Este es un mensaje automático de Obrapp.</p></div>`;
  if (!emailActivo()) {
    await db.insert(schema.auditoria).values({ accion: "email.simulado", detalle: `${to} · ${asunto}${link ? ` · ${link}` : ""}` });
    console.info(`[email simulado] ${to} · ${asunto}${link ? ` · ${link}` : ""}`);
    return { ok: true, simulado: true };
  }
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: process.env.EMAIL_FROM ?? "Obrapp <no-responder@obrapp.com.ar>", to: [to], subject: asunto, text: texto + (link ? `\n\n${link}` : ""), html }),
    });
    if (!r.ok) throw new Error(`Resend ${r.status}: ${await r.text()}`);
    await db.insert(schema.auditoria).values({ accion: "email.enviado", detalle: `${to} · ${asunto}` });
    return { ok: true, simulado: false };
  } catch (e) {
    await db.insert(schema.auditoria).values({ accion: "email.error", detalle: `${to} · ${asunto} · ${e instanceof Error ? e.message : e}` });
    return { ok: false, simulado: false };
  }
}

const escapar = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
export const urlApp = () => process.env.APP_URL ?? "http://localhost:3000";
