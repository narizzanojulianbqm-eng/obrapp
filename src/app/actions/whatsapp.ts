"use server";
import bcrypt from "bcryptjs";
import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, schema } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { assertObra, auditar } from "@/lib/access";
import { obrasDelUsuario } from "@/lib/queries";
import { normalizarTelefono } from "@/lib/whatsapp/telefono";
import { enviarBienvenida } from "@/lib/whatsapp/enviar";
import { procesarEntrante } from "@/lib/whatsapp/entrada";
import { simuladorHabilitado } from "@/lib/whatsapp/config";
import { PLANES } from "@/lib/planes";
import type { FormState } from "./auth";

/** Busca o crea el usuario de una persona que va a usar solo WhatsApp (no necesita registrarse en la web). */
async function usuarioParaTelefono(telefono: string, nombre: string, email?: string) {
  if (email) {
    const u = await db.query.users.findFirst({ where: eq(schema.users.email, email) });
    if (u) return u;
  }
  const c = await db.query.waContactos.findFirst({ where: eq(schema.waContactos.telefono, telefono) });
  if (c?.userId) return (await db.query.users.findFirst({ where: eq(schema.users.id, c.userId) }))!;
  const [u] = await db
    .insert(schema.users)
    .values({ nombre: nombre || `WhatsApp ${telefono.slice(-4)}`, email: email || `wa-${telefono}@whatsapp.obrapp.local`, passwordHash: await bcrypt.hash(crypto.randomUUID(), 10), telefono })
    .returning();
  return u;
}

/** El arquitecto suma a una persona a la obra por su número de WhatsApp y se le envía la bienvenida. */
export async function vincularPorWhatsApp(_: FormState, fd: FormData): Promise<FormState> {
  const obraId = String(fd.get("obraId") ?? "");
  const { user, obra } = await assertObra(obraId, ["arquitecto"]);
  const telefono = normalizarTelefono(String(fd.get("telefono") ?? ""));
  if (!telefono) return { error: "Teléfono inválido. Usá el formato con código de área, ej. 11 5555 4444." };
  const nombre = String(fd.get("nombre") ?? "").trim();
  const rol = String(fd.get("rol") ?? "obrero") as "obrero" | "cliente" | "arquitecto";
  const email = String(fd.get("email") ?? "").trim().toLowerCase() || undefined;
  if (!nombre) return { error: "Ingresá el nombre de la persona" };

  const existente = await db.query.waContactos.findFirst({ where: eq(schema.waContactos.telefono, telefono) });
  const persona = existente?.userId ? (await db.query.users.findFirst({ where: eq(schema.users.id, existente.userId) }))! : await usuarioParaTelefono(telefono, nombre, email);
  if (persona.id === obra.ownerId && rol !== "arquitecto") return { error: "Ese número es tuyo." };

  const ms = await db.query.miembros.findMany({ where: eq(schema.miembros.obraId, obraId) });
  let miembro = ms.find((m) => m.userId === persona.id || m.email === persona.email);
  if (!miembro && persona.id !== obra.ownerId) {
    const owner = (await db.query.users.findFirst({ where: eq(schema.users.id, obra.ownerId) }))!;
    if (ms.length >= PLANES[owner.plan].miembrosPorObra) return { error: "Alcanzaste el límite de miembros de tu plan." };
    [miembro] = await db.insert(schema.miembros).values({ obraId, userId: persona.id, email: persona.email, nombre, rol, oficio: String(fd.get("oficio") ?? "").trim() || null }).returning();
  }
  let c = existente;
  if (!c) [c] = await db.insert(schema.waContactos).values({ telefono, userId: persona.id, nombre, estado: "invitado", invitadoPor: user.id, obraActivaId: obraId }).returning();
  else if (!c.userId) [c] = await db.update(schema.waContactos).set({ userId: persona.id, nombre, invitadoPor: user.id, obraActivaId: obraId }).where(eq(schema.waContactos.id, c.id)).returning();
  await db.update(schema.users).set({ telefono }).where(eq(schema.users.id, persona.id));
  await enviarBienvenida(c, obra.nombre, miembro?.rol ?? rol);
  await auditar(obraId, user.id, "whatsapp.invitar", `${nombre} ${telefono} (${miembro?.rol ?? rol})`);
  revalidatePath("/whatsapp");
  revalidatePath(`/obras/${obraId}/equipo`);
  return { ok: `Listo. Se envió la bienvenida a ${nombre}. El canal queda activo cuando responda.` };
}

/** Un usuario registrado vincula su propio número: se genera un código que debe enviar desde ese WhatsApp. */
export async function generarCodigoVinculacion(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  const telefono = normalizarTelefono(String(fd.get("telefono") ?? ""));
  if (!telefono) return { error: "Teléfono inválido" };
  const otro = await db.query.waContactos.findFirst({ where: eq(schema.waContactos.telefono, telefono) });
  if (otro?.userId && otro.userId !== user.id) return { error: "Ese número ya está vinculado a otra cuenta." };
  const codigo = String(Math.floor(100000 + Math.random() * 900000));
  const expira = new Date(Date.now() + 15 * 60 * 1000);
  if (otro) await db.update(schema.waContactos).set({ userId: user.id, codigoVinculacion: codigo, codigoExpira: expira, estado: otro.estado === "bloqueado" ? "bloqueado" : "invitado" }).where(eq(schema.waContactos.id, otro.id));
  else await db.insert(schema.waContactos).values({ telefono, userId: user.id, nombre: user.nombre, codigoVinculacion: codigo, codigoExpira: expira });
  revalidatePath("/configuracion");
  return { ok: `Enviá "VINCULAR ${codigo}" al WhatsApp de Obrapp desde ese número. El código vence en 15 minutos.` };
}

async function contactoGestionable(contactoId: string) {
  const user = await requireUser();
  const c = await db.query.waContactos.findFirst({ where: eq(schema.waContactos.id, contactoId) });
  if (!c) throw new Error("Contacto inexistente");
  if (c.userId === user.id) return { user, c };
  // el arquitecto puede gestionar contactos de las personas de sus obras
  const mias = (await obrasDelUsuario(user)).filter((o) => o.rol === "arquitecto").map((o) => o.obra.id);
  const ms = mias.length && c.userId ? await db.query.miembros.findMany({ where: and(inArray(schema.miembros.obraId, mias), eq(schema.miembros.userId, c.userId)) }) : [];
  if (!ms.length) throw new Error("No podés gestionar este contacto");
  return { user, c };
}

export async function cambiarNotificacionesWA(contactoId: string, valor: boolean) {
  const { c } = await contactoGestionable(contactoId);
  await db.update(schema.waContactos).set({ notificaciones: valor }).where(eq(schema.waContactos.id, c.id));
  revalidatePath("/whatsapp");
}

export async function bloquearContactoWA(contactoId: string, bloquear: boolean) {
  const { c, user } = await contactoGestionable(contactoId);
  await db.update(schema.waContactos).set({ estado: bloquear ? "bloqueado" : "activo" }).where(eq(schema.waContactos.id, c.id));
  await auditar(null, user.id, bloquear ? "whatsapp.bloquear" : "whatsapp.desbloquear", c.telefono);
  revalidatePath("/whatsapp");
}

export async function reenviarBienvenidaWA(contactoId: string, obraId: string) {
  const { c } = await contactoGestionable(contactoId);
  const { obra } = await assertObra(obraId, ["arquitecto"]);
  const m = await db.query.miembros.findFirst({ where: and(eq(schema.miembros.obraId, obraId), eq(schema.miembros.userId, c.userId ?? "")) });
  await enviarBienvenida(c, obra.nombre, m?.rol ?? "obrero");
  revalidatePath("/whatsapp");
}

/** Simulador: inyecta un mensaje entrante como si llegara por el webhook de Meta (solo modo prueba). */
export async function simularMensaje(contactoId: string, _: FormState, fd: FormData): Promise<FormState> {
  if (!simuladorHabilitado()) return { error: "El simulador está deshabilitado en este entorno." };
  const { c } = await contactoGestionable(contactoId);
  const texto = String(fd.get("texto") ?? "").trim();
  const archivo = fd.get("archivo") as File | null;
  const tieneArchivo = archivo && archivo.size > 0;
  if (!texto && !tieneArchivo) return { error: "Escribí un mensaje o adjuntá un archivo" };
  let tipo: "text" | "image" | "audio" | "document" | "video" = "text";
  let media;
  if (tieneArchivo) {
    tipo = archivo.type.startsWith("image/") ? "image" : archivo.type.startsWith("audio/") ? "audio" : archivo.type.startsWith("video/") ? "video" : "document";
    media = { buf: Buffer.from(await archivo.arrayBuffer()), mime: archivo.type || "application/octet-stream", nombre: archivo.name };
  }
  await procesarEntrante({ telefono: c.telefono, tipo, texto, media, simulado: true, waMessageId: `sim-${crypto.randomUUID()}` });
  revalidatePath("/whatsapp");
  return { ok: "enviado" };
}
