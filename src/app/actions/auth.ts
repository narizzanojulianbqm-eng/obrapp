"use server";
import bcrypt from "bcryptjs";
import { eq, and, isNull, gt } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db, schema } from "@/lib/db";
import { createSession } from "@/lib/auth";
import { limpiarFallos, minutosBloqueado, registrarFallo } from "@/lib/limites";
import crypto from "node:crypto";

export type FormState = { error?: string; ok?: string } | undefined;

const registro = z.object({
  nombre: z.string().trim().min(2, "Ingresá tu nombre"),
  email: z.string().trim().toLowerCase().email("Email inválido"),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
});

export async function registrar(_: FormState, fd: FormData): Promise<FormState> {
  const p = registro.safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: p.error.issues[0].message };
  const existe = await db.query.users.findFirst({ where: eq(schema.users.email, p.data.email) });
  if (existe) return { error: "Ya existe una cuenta con ese email" };
  const [u] = await db
    .insert(schema.users)
    .values({ nombre: p.data.nombre, email: p.data.email, passwordHash: await bcrypt.hash(p.data.password, 10) })
    .returning();
  // Vincula invitaciones pendientes (el arquitecto pudo haberlo sumado a una obra antes de que se registre)
  await db.update(schema.miembros).set({ userId: u.id }).where(and(eq(schema.miembros.email, u.email), isNull(schema.miembros.userId)));
  await createSession(u.id);
  redirect("/dashboard");
}

export async function iniciarSesion(_: FormState, fd: FormData): Promise<FormState> {
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  const password = String(fd.get("password") ?? "");
  const clave = `login:${email}`;
  const bloq = await minutosBloqueado(clave);
  if (bloq) return { error: `Demasiados intentos fallidos. Probá de nuevo en ${bloq} minuto(s) o recuperá tu contraseña.` };
  const u = await db.query.users.findFirst({ where: eq(schema.users.email, email) });
  if (!u || !(await bcrypt.compare(password, u.passwordHash))) {
    await registrarFallo(clave);
    return { error: "Email o contraseña incorrectos" };
  }
  await limpiarFallos(clave);
  await createSession(u.id);
  const next = String(fd.get("next") ?? "");
  redirect(next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard");
}

// ───────── Recuperación de contraseña (por email o por WhatsApp) ─────────
const sha = (t: string) => crypto.createHash("sha256").update(t).digest("hex");

export async function solicitarRecuperacion(_: FormState, fd: FormData): Promise<FormState> {
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  const generico = { ok: "Si hay una cuenta con ese email, te enviamos un link por email y/o un código por WhatsApp. Vence en 30 minutos." };
  if (!z.string().email().safeParse(email).success) return { error: "Email inválido" };
  const clave = `reset:${email}`;
  if (await minutosBloqueado(clave)) return generico;
  await registrarFallo(clave); // limita la cantidad de pedidos por email
  const u = await db.query.users.findFirst({ where: eq(schema.users.email, email) });
  if (!u) return generico;
  const token = crypto.randomBytes(16).toString("hex");
  const codigo = String(crypto.randomInt(100000, 1000000));
  const expira = new Date(Date.now() + 30 * 60000);
  await db.insert(schema.resetTokens).values([{ userId: u.id, hash: sha(token), expira }, { userId: u.id, hash: sha(`${u.id}:${codigo}`), expira }]);
  const { enviarEmail, urlApp } = await import("@/lib/email");
  await enviarEmail({ to: u.email, asunto: "Recuperar tu contraseña de Obrapp", texto: `Hola ${u.nombre}: pediste cambiar tu contraseña. Usá el botón (vence en 30 minutos). Si no fuiste vos, ignorá este mensaje.`, link: `${urlApp()}/recuperar?email=${encodeURIComponent(email)}&t=${token}`, linkTexto: "Elegir nueva contraseña" });
  const c = await db.query.waContactos.findFirst({ where: and(eq(schema.waContactos.userId, u.id), eq(schema.waContactos.estado, "activo")) });
  if (c) {
    const { enviarAContacto } = await import("@/lib/whatsapp/enviar");
    await enviarAContacto(c, null, { texto: `🔐 Tu código para recuperar la contraseña de Obrapp es *${codigo}*. Vence en 30 minutos. No lo compartas con nadie.` });
  }
  return generico;
}

export async function restablecerContrasena(_: FormState, fd: FormData): Promise<FormState> {
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  const codigo = String(fd.get("codigo") ?? "").trim();
  const password = String(fd.get("password") ?? "");
  if (password.length < 8) return { error: "La contraseña debe tener al menos 8 caracteres" };
  const clave = `reset-uso:${email}`;
  if (await minutosBloqueado(clave)) return { error: "Demasiados intentos. Esperá unos minutos." };
  const u = await db.query.users.findFirst({ where: eq(schema.users.email, email) });
  const candidatos = u ? await db.query.resetTokens.findMany({ where: and(eq(schema.resetTokens.userId, u.id), eq(schema.resetTokens.usado, false), gt(schema.resetTokens.expira, new Date())) }) : [];
  const ok = u && candidatos.find((t) => t.hash === sha(codigo) || t.hash === sha(`${u.id}:${codigo}`));
  if (!u || !ok) {
    await registrarFallo(clave);
    return { error: "El código o link no es válido o venció." };
  }
  await db.update(schema.users).set({ passwordHash: await bcrypt.hash(password, 10) }).where(eq(schema.users.id, u.id));
  await db.update(schema.resetTokens).set({ usado: true }).where(eq(schema.resetTokens.userId, u.id));
  await limpiarFallos(clave);
  await limpiarFallos(`login:${email}`);
  await db.insert(schema.auditoria).values({ userId: u.id, accion: "auth.reset_password" });
  await createSession(u.id);
  redirect("/dashboard");
}
