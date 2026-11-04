"use server";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, schema } from "@/lib/db";
import { assertObra, auditar, notificar } from "@/lib/access";
import { guardarArchivos } from "@/lib/files";
import { puedeCanal, rolesDeCanal } from "@/lib/canales";
import type { FormState } from "./auth";

export async function enviarMensaje(obraId: string, canal: string, _: FormState, fd: FormData): Promise<FormState> {
  const { user, rol } = await assertObra(obraId);
  if (!puedeCanal(rol, canal)) return { error: "No tenés acceso a esta conversación" };
  if (canal.startsWith("item:")) {
    const it = await db.query.items.findFirst({ where: and(eq(schema.items.id, canal.slice(5)), eq(schema.items.obraId, obraId)) });
    if (!it) return { error: "Tarea inexistente" };
  }
  const texto = String(fd.get("texto") ?? "").trim();
  const tipo = (String(fd.get("tipo") ?? "mensaje") as "mensaje" | "decision" | "cambio" | "observacion");
  const archivos = fd.getAll("adjuntos") as File[];
  if (!texto && !archivos.some((f) => f.size > 0)) return { error: "Escribí un mensaje o adjuntá un archivo" };
  const visibles = rolesDeCanal(canal);
  const adjuntos = await guardarArchivos(obraId, user.id, archivos, { visibleCliente: visibles.includes("cliente"), visibleObrero: visibles.includes("obrero") });
  await db.insert(schema.mensajes).values({ obraId, canal, autorId: user.id, texto: texto || "(adjunto)", tipo, adjuntos });
  const etiqueta = tipo === "cambio" ? "solicitó un cambio" : tipo === "decision" ? "registró una decisión" : tipo === "observacion" ? "hizo una observación" : "escribió";
  await notificar(obraId, rolesDeCanal(canal), `${user.nombre} ${etiqueta}: ${texto.slice(0, 80)}`, canal.startsWith("item:") ? `/obras/${obraId}/tarea/${canal.slice(5)}` : `/obras/${obraId}/mensajes?canal=${encodeURIComponent(canal)}`, user.id);
  if (canal.startsWith("item:")) revalidatePath(`/obras/${obraId}/tarea/${canal.slice(5)}`);
  if (tipo !== "mensaje") await auditar(obraId, user.id, `mensaje.${tipo}`, texto.slice(0, 200));
  revalidatePath(`/obras/${obraId}/mensajes`);
  return { ok: "enviado" };
}

export async function subirDocumento(obraId: string, _: FormState, fd: FormData): Promise<FormState> {
  const { user } = await assertObra(obraId, ["arquitecto"]);
  const files = fd.getAll("archivos") as File[];
  if (!files.some((f) => f.size > 0)) return { error: "Elegí al menos un archivo" };
  try {
    await guardarArchivos(obraId, user.id, files, {
      categoria: String(fd.get("categoria") ?? "general"),
      visibleCliente: fd.get("visibleCliente") === "on",
      visibleObrero: fd.get("visibleObrero") === "on",
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Error al subir" };
  }
  if (fd.get("visibleCliente") === "on") await notificar(obraId, ["cliente"], `Nueva documentación disponible en la obra`, `/obras/${obraId}/documentos`, user.id);
  await auditar(obraId, user.id, "documento.subir", files.map((f) => f.name).join(", "));
  revalidatePath(`/obras/${obraId}/documentos`);
  return { ok: "Documentos subidos." };
}

export async function eliminarDocumento(docId: string) {
  const d = await db.query.documentos.findFirst({ where: eq(schema.documentos.id, docId) });
  if (!d) return;
  const { user } = await assertObra(d.obraId, ["arquitecto"]);
  await db.delete(schema.documentos).where(and(eq(schema.documentos.id, docId)));
  await auditar(d.obraId, user.id, "documento.eliminar", d.nombre);
}

export async function cambiarVisibilidadDocumento(docId: string, campo: "visibleCliente" | "visibleObrero", valor: boolean) {
  const d = await db.query.documentos.findFirst({ where: eq(schema.documentos.id, docId) });
  if (!d) return;
  await assertObra(d.obraId, ["arquitecto"]);
  await db.update(schema.documentos).set({ [campo]: valor }).where(eq(schema.documentos.id, docId));
}
