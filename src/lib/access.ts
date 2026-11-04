import "server-only";
import { and, eq, inArray, or } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { db, schema } from "./db";
import { requireUser } from "./auth";
import type { Rol } from "./db/schema";

export type Acceso = {
  user: typeof schema.users.$inferSelect;
  obra: typeof schema.obras.$inferSelect;
  rol: Rol;
  miembroId: string | null;
  esDueno: boolean;
};

/** Devuelve el rol del usuario en la obra o null si no tiene acceso. Única puerta de entrada a los datos de una obra. */
export async function rolEnObra(userId: string, email: string, obraId: string) {
  const obra = await db.query.obras.findFirst({ where: eq(schema.obras.id, obraId) });
  if (!obra) return null;
  if (obra.ownerId === userId) return { obra, rol: "arquitecto" as Rol, miembroId: null, esDueno: true };
  const m = await db.query.miembros.findFirst({
    where: and(eq(schema.miembros.obraId, obraId), or(eq(schema.miembros.userId, userId), eq(schema.miembros.email, email))),
  });
  if (!m) return null;
  return { obra, rol: m.rol as Rol, miembroId: m.id, esDueno: false };
}

export async function requireObra(obraId: string, roles?: Rol[]): Promise<Acceso> {
  const user = await requireUser();
  const r = await rolEnObra(user.id, user.email, obraId);
  if (!r) notFound();
  if (roles && !roles.includes(r.rol)) redirect(`/obras/${obraId}`);
  return { user, ...r };
}

/** Para server actions: lanza error en vez de redirigir. */
export async function assertObra(obraId: string, roles?: Rol[]): Promise<Acceso> {
  const user = await requireUser();
  const r = await rolEnObra(user.id, user.email, obraId);
  if (!r) throw new Error("Sin acceso a esta obra");
  if (roles && !roles.includes(r.rol)) throw new Error("Tu perfil no tiene permiso para esta acción");
  return { user, ...r };
}

export const puede = {
  verCostos: (rol: Rol) => rol === "arquitecto",
  editarObra: (rol: Rol) => rol === "arquitecto",
  verPresupuestoCliente: (rol: Rol) => rol !== "obrero",
};

export async function auditar(obraId: string | null, userId: string | null, accion: string, detalle?: string) {
  await db.insert(schema.auditoria).values({ obraId, userId, accion, detalle });
}

/** Notifica a los miembros de la obra con los roles indicados (excepto al autor). */
export async function notificar(obraId: string, roles: Rol[], texto: string, link: string, exceptUserId?: string, opciones: { whatsapp?: boolean } = {}) {
  const obra = await db.query.obras.findFirst({ where: eq(schema.obras.id, obraId) });
  if (!obra) return;
  const destinatarios = new Set<string>();
  if (roles.includes("arquitecto")) destinatarios.add(obra.ownerId);
  const ms = await db.query.miembros.findMany({ where: eq(schema.miembros.obraId, obraId) });
  for (const m of ms) {
    if (!roles.includes(m.rol as Rol)) continue;
    let uid = m.userId;
    if (!uid) {
      const u = await db.query.users.findFirst({ where: eq(schema.users.email, m.email) });
      uid = u?.id ?? null;
    }
    if (uid) destinatarios.add(uid);
  }
  if (exceptUserId) destinatarios.delete(exceptUserId);
  if (destinatarios.size === 0) return;
  await db.insert(schema.notificaciones).values([...destinatarios].map((userId) => ({ userId, obraId, texto, link })));
  // Mismo evento, otro canal: quienes tengan WhatsApp vinculado reciben el aviso ahí también.
  // Desde oct-2026 Meta cobra cada mensaje: por WhatsApp solo va lo que requiere atención (opciones.whatsapp=false lo omite).
  if (opciones.whatsapp !== false) {
    const { notificarPorWhatsApp } = await import("./whatsapp/enviar");
    await notificarPorWhatsApp([...destinatarios], obraId, texto, link);
    // Quien no usa WhatsApp recibe el aviso importante por email (si no lo desactivó)
    const { enviarEmail, urlApp } = await import("./email");
    const conWa = new Set((await db.query.waContactos.findMany({ where: and(inArray(schema.waContactos.userId, [...destinatarios]), eq(schema.waContactos.estado, "activo")) })).map((c) => c.userId));
    const sinWa = [...destinatarios].filter((u) => !conWa.has(u));
    if (sinWa.length) {
      const us = await db.query.users.findMany({ where: inArray(schema.users.id, sinWa) });
      for (const u of us) if (u.avisosEmail) await enviarEmail({ to: u.email, asunto: `${obra.nombre}: novedad`, texto, link: `${urlApp()}${link}`, linkTexto: "Ver en Obrapp" });
    }
  }
}
