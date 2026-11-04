import "server-only";
import crypto from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { db, schema } from "./db";

/**
 * Suscripciones con Mercado Pago (API de Suscripciones / preapproval).
 * Sin MP_ACCESS_TOKEN funciona en modo prueba: el cambio de plan es inmediato y queda registrado.
 */
export const mpActivo = () => !!process.env.MP_ACCESS_TOKEN;
export function precioPlan(plan: "profesional" | "estudio"): number | null {
  const v = Number(plan === "profesional" ? process.env.PRECIO_PLAN_PROFESIONAL : process.env.PRECIO_PLAN_ESTUDIO);
  return v > 0 ? v : null;
}
const MP = "https://api.mercadopago.com";
const h = () => ({ Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}`, "Content-Type": "application/json" });

export async function iniciarSuscripcion(user: { id: string; email: string }, plan: "profesional" | "estudio"): Promise<{ url?: string; modoPrueba?: boolean }> {
  const monto = precioPlan(plan);
  if (!mpActivo()) {
    await db.insert(schema.suscripciones).values({ userId: user.id, plan, estado: "activa", proveedor: "prueba", monto: monto ?? 0 });
    await db.update(schema.users).set({ plan }).where(eq(schema.users.id, user.id));
    return { modoPrueba: true };
  }
  if (!monto) throw new Error("Falta configurar el precio del plan (PRECIO_PLAN_PROFESIONAL / PRECIO_PLAN_ESTUDIO).");
  const r = await fetch(`${MP}/preapproval`, {
    method: "POST",
    headers: h(),
    body: JSON.stringify({
      reason: `Obrapp – Plan ${plan === "profesional" ? "Profesional" : "Estudio / Constructora"}`,
      external_reference: `${user.id}:${plan}`,
      payer_email: user.email,
      auto_recurring: { frequency: 1, frequency_type: "months", transaction_amount: monto, currency_id: "ARS" },
      back_url: `${process.env.APP_URL ?? "http://localhost:3000"}/configuracion?pago=ok`,
      status: "pending",
    }),
  });
  const j = (await r.json()) as { id?: string; init_point?: string; message?: string };
  if (!r.ok || !j.init_point) throw new Error(`Mercado Pago: ${j.message ?? r.status}`);
  await db.insert(schema.suscripciones).values({ userId: user.id, plan, estado: "pendiente", idExterno: j.id, monto, checkoutUrl: j.init_point });
  return { url: j.init_point };
}

export async function cancelarSuscripcion(userId: string) {
  const s = await db.query.suscripciones.findFirst({ where: and(eq(schema.suscripciones.userId, userId), eq(schema.suscripciones.estado, "activa")), orderBy: desc(schema.suscripciones.createdAt) });
  if (s?.idExterno && mpActivo()) await fetch(`${MP}/preapproval/${s.idExterno}`, { method: "PUT", headers: h(), body: JSON.stringify({ status: "cancelled" }) });
  if (s) await db.update(schema.suscripciones).set({ estado: "cancelada" }).where(eq(schema.suscripciones.id, s.id));
  await db.update(schema.users).set({ plan: "gratuito" }).where(eq(schema.users.id, userId));
}

/** Sincroniza el estado de una suscripción a partir del webhook de Mercado Pago. */
export async function sincronizarPreapproval(id: string) {
  const r = await fetch(`${MP}/preapproval/${id}`, { headers: h() });
  if (!r.ok) return;
  const j = (await r.json()) as { status?: string; external_reference?: string };
  const s = await db.query.suscripciones.findFirst({ where: eq(schema.suscripciones.idExterno, id) });
  if (!s) return;
  const estado = j.status === "authorized" ? "activa" : j.status === "paused" ? "pausada" : j.status === "cancelled" ? "cancelada" : "pendiente";
  await db.update(schema.suscripciones).set({ estado }).where(eq(schema.suscripciones.id, s.id));
  await db.update(schema.users).set({ plan: estado === "activa" ? s.plan : "gratuito" }).where(eq(schema.users.id, s.userId));
  await db.insert(schema.auditoria).values({ userId: s.userId, accion: `suscripcion.${estado}`, detalle: `${s.plan} · ${id}` });
}

/** Valida la firma x-signature de Mercado Pago (si MP_WEBHOOK_SECRET está configurado). */
export function firmaMPValida(req: Request, dataId: string): boolean {
  const secret = process.env.MP_WEBHOOK_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
  const sig = req.headers.get("x-signature") ?? "";
  const reqId = req.headers.get("x-request-id") ?? "";
  const partes = Object.fromEntries(sig.split(",").map((p) => p.trim().split("=") as [string, string]));
  if (!partes.ts || !partes.v1) return false;
  const manifest = `id:${dataId.toLowerCase()};request-id:${reqId};ts:${partes.ts};`;
  const esperada = crypto.createHmac("sha256", secret).update(manifest).digest("hex");
  return esperada.length === partes.v1.length && crypto.timingSafeEqual(Buffer.from(esperada), Buffer.from(partes.v1));
}
