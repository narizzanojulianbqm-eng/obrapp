"use server";
import { and, eq, inArray, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db, schema } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { assertObra, auditar, notificar } from "@/lib/access";
import { generarDesdePlantilla, recalcularObra, siguienteCodigoObra } from "@/lib/obra-service";
import { PLANES } from "@/lib/planes";
import { PARAMETROS_INFO, parametrosPorDefecto, TIPOS_OBRA, SISTEMAS } from "@/lib/engine/plantillas";
import { generaCiclo } from "@/lib/engine/calculos";
import { ajustarHabil } from "@/lib/engine/calendario";
import { guardarArchivos } from "@/lib/files";
import type { FormState } from "./auth";

const numOpt = z.preprocess((v) => (v === "" || v == null ? undefined : Number(String(v).replace(",", "."))), z.number().nonnegative().optional());
const strOpt = z.preprocess((v) => (v === "" || v == null ? undefined : String(v).trim()), z.string().optional());

const obraSchema = z.object({
  nombre: z.string().trim().min(2, "Ingresá un nombre para la obra"),
  direccion: strOpt,
  localidad: strOpt,
  provincia: strOpt,
  tipo: z.enum(Object.keys(TIPOS_OBRA) as [string, ...string[]]),
  sistema: z.enum(Object.keys(SISTEMAS) as [string, ...string[]]),
  supCubierta: z.coerce.number().positive("La superficie cubierta debe ser mayor a 0"),
  supSemicubierta: numOpt,
  niveles: z.coerce.number().int().min(1).max(60),
  fechaInicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha de inicio inválida"),
  duracionEstimadaDias: numOpt,
  clienteNombre: strOpt,
  clienteEmail: z.preprocess((v) => (v === "" ? undefined : v), z.string().trim().toLowerCase().email("Email del cliente inválido").optional()),
  clienteTelefono: strOpt,
  arquitectoResponsable: strOpt,
  caracteristicas: strOpt,
  presupuestoInicial: numOpt,
});

export async function crearObra(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  const p = obraSchema.safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: p.error.issues[0].message };
  const [{ n }] = await db
    .select({ n: sql<number>`count(*)` })
    .from(schema.obras)
    .where(and(eq(schema.obras.ownerId, user.id), eq(schema.obras.estado, "activa")));
  const limite = PLANES[user.plan].obrasActivas;
  if (Number(n) >= limite) return { error: `Tu plan ${PLANES[user.plan].nombre} permite ${limite} obra(s) activa(s). Finalizá una obra o cambiá de plan en Configuración.` };

  const d = p.data;
  const [obra] = await db
    .insert(schema.obras)
    .values({
      ...d,
      supSemicubierta: d.supSemicubierta ?? 0,
      duracionEstimadaDias: d.duracionEstimadaDias ? Math.round(d.duracionEstimadaDias) : null,
      fechaInicio: ajustarHabil(d.fechaInicio),
      ownerId: user.id,
      codigo: await siguienteCodigoObra(user.id),
      arquitectoResponsable: d.arquitectoResponsable ?? user.nombre,
      parametros: {},
    })
    .returning();

  if (d.clienteEmail) {
    const u = await db.query.users.findFirst({ where: eq(schema.users.email, d.clienteEmail) });
    await db.insert(schema.miembros).values({ obraId: obra.id, email: d.clienteEmail, nombre: d.clienteNombre, rol: "cliente", userId: u?.id ?? null });
  }
  // Equipo de trabajo: líneas "email, rol, nombre"
  const equipo = String(fd.get("equipo") ?? "").split("\n").map((l) => l.trim()).filter(Boolean);
  for (const l of equipo) {
    const [email, nombre, oficio] = l.split(/[,;]/).map((x) => x?.trim());
    if (!email || !z.string().email().safeParse(email.toLowerCase()).success) continue;
    const u = await db.query.users.findFirst({ where: eq(schema.users.email, email.toLowerCase()) });
    await db.insert(schema.miembros).values({ obraId: obra.id, email: email.toLowerCase(), nombre: nombre || null, oficio: oficio || null, rol: "obrero", userId: u?.id ?? null });
  }

  await generarDesdePlantilla(obra);
  await auditar(obra.id, user.id, "obra.crear", obra.nombre);
  redirect(`/obras/${obra.id}?nueva=1`);
}

export async function actualizarObra(obraId: string, _: FormState, fd: FormData): Promise<FormState> {
  const { user, obra } = await assertObra(obraId, ["arquitecto"]);
  const p = obraSchema.safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: p.error.issues[0].message };
  const d = p.data;
  const cambioSistema = d.sistema !== obra.sistema || d.tipo !== obra.tipo;
  await db
    .update(schema.obras)
    .set({
      ...d,
      supSemicubierta: d.supSemicubierta ?? 0,
      duracionEstimadaDias: d.duracionEstimadaDias ? Math.round(d.duracionEstimadaDias) : null,
      fechaInicio: ajustarHabil(d.fechaInicio),
      clienteEmail: d.clienteEmail ?? null,
      presupuestoInicial: d.presupuestoInicial ?? null,
      estado: (fd.get("estado") as "activa" | "pausada" | "finalizada") ?? obra.estado,
    })
    .where(eq(schema.obras.id, obraId));
  if (d.clienteEmail && d.clienteEmail !== obra.clienteEmail) {
    const ya = await db.query.miembros.findFirst({ where: and(eq(schema.miembros.obraId, obraId), eq(schema.miembros.email, d.clienteEmail)) });
    if (!ya) {
      const u = await db.query.users.findFirst({ where: eq(schema.users.email, d.clienteEmail) });
      await db.insert(schema.miembros).values({ obraId, email: d.clienteEmail, nombre: d.clienteNombre, rol: "cliente", userId: u?.id ?? null });
    }
  }
  await recalcularObra(obraId);
  await auditar(obraId, user.id, "obra.editar", cambioSistema ? "Cambio de tipo/sistema" : undefined);
  revalidatePath(`/obras/${obraId}`, "layout");
  return { ok: cambioSistema ? "Guardado. Cambiaste el tipo o sistema: podés regenerar los rubros desde la plantilla." : "Datos guardados. Cómputo, presupuesto y cronograma recalculados." };
}

export async function actualizarParametros(obraId: string, _: FormState, fd: FormData): Promise<FormState> {
  const { user, obra } = await assertObra(obraId, ["arquitecto"]);
  const defs = parametrosPorDefecto(obra);
  const nuevos: Record<string, number> = {};
  for (const k of Object.keys(PARAMETROS_INFO)) {
    const raw = String(fd.get(k) ?? "").trim();
    if (raw === "") continue;
    const v = Number(raw.replace(",", "."));
    if (isNaN(v) || v < 0) return { error: `Valor inválido en "${PARAMETROS_INFO[k].label}"` };
    if (Math.abs(v - (defs[k] ?? -1)) > 1e-9) nuevos[k] = v;
  }
  const cuadrilla = Number(String(fd.get("cuadrillaHHdia") ?? obra.cuadrillaHHdia).replace(",", "."));
  await db.update(schema.obras).set({ parametros: nuevos, cuadrillaHHdia: cuadrilla > 0 ? cuadrilla : obra.cuadrillaHHdia }).where(eq(schema.obras.id, obraId));
  await recalcularObra(obraId);
  await auditar(obraId, user.id, "obra.parametros", JSON.stringify(nuevos));
  revalidatePath(`/obras/${obraId}`, "layout");
  return { ok: "Parámetros guardados. Cantidades, duraciones y cronograma actualizados." };
}

export async function actualizarCoeficientes(obraId: string, _: FormState, fd: FormData): Promise<FormState> {
  const { user } = await assertObra(obraId, ["arquitecto"]);
  const v = (k: string) => Math.max(0, Number(String(fd.get(k) ?? 0).replace(",", ".")) || 0);
  await db
    .update(schema.obras)
    .set({ gastosGeneralesPct: v("gastosGeneralesPct"), beneficioPct: v("beneficioPct"), honorariosPct: v("honorariosPct"), ivaPct: v("ivaPct"), clientePuedeVerDetalle: fd.get("clientePuedeVerDetalle") === "on" })
    .where(eq(schema.obras.id, obraId));
  await auditar(obraId, user.id, "presupuesto.coeficientes");
  revalidatePath(`/obras/${obraId}`, "layout");
  return { ok: "Coeficientes actualizados." };
}

export async function regenerarDesdePlantilla(obraId: string) {
  const { user, obra } = await assertObra(obraId, ["arquitecto"]);
  await db.delete(schema.rubros).where(eq(schema.rubros.obraId, obraId)); // cascada a ítems y recursos
  await generarDesdePlantilla(obra);
  await auditar(obraId, user.id, "rubros.regenerar");
  revalidatePath(`/obras/${obraId}`, "layout");
}

export async function eliminarObra(obraId: string) {
  const { user, esDueno } = await assertObra(obraId, ["arquitecto"]);
  if (!esDueno) throw new Error("Solo el titular puede eliminar la obra");
  await db.delete(schema.obras).where(eq(schema.obras.id, obraId));
  await auditar(null, user.id, "obra.eliminar", obraId);
  redirect("/obras");
}

// ───────── Rubros e ítems ─────────
async function itemDeObra(itemId: string) {
  const it = await db.query.items.findFirst({ where: eq(schema.items.id, itemId) });
  if (!it) throw new Error("Ítem inexistente");
  return it;
}

export async function crearRubro(obraId: string, fd: FormData) {
  const { user } = await assertObra(obraId, ["arquitecto"]);
  const nombre = String(fd.get("nombre") ?? "").trim();
  if (!nombre) return;
  const [{ m }] = await db.select({ m: sql<number>`coalesce(max(orden),0)` }).from(schema.rubros).where(eq(schema.rubros.obraId, obraId));
  const orden = Number(m) + 1;
  await db.insert(schema.rubros).values({ obraId, nombre, orden, codigo: String(orden).padStart(2, "0") });
  await auditar(obraId, user.id, "rubro.crear", nombre);
  revalidatePath(`/obras/${obraId}`, "layout");
}

export async function renombrarRubro(rubroId: string, nombre: string) {
  const r = await db.query.rubros.findFirst({ where: eq(schema.rubros.id, rubroId) });
  if (!r) throw new Error("Rubro inexistente");
  await assertObra(r.obraId, ["arquitecto"]);
  await db.update(schema.rubros).set({ nombre }).where(eq(schema.rubros.id, rubroId));
}

export async function eliminarRubro(rubroId: string) {
  const r = await db.query.rubros.findFirst({ where: eq(schema.rubros.id, rubroId) });
  if (!r) throw new Error("Rubro inexistente");
  const { user } = await assertObra(r.obraId, ["arquitecto"]);
  const its = await db.query.items.findMany({ where: eq(schema.items.rubroId, rubroId) });
  await limpiarPredecesoras(r.obraId, its.map((i) => i.id));
  await db.delete(schema.rubros).where(eq(schema.rubros.id, rubroId));
  await recalcularObra(r.obraId);
  await auditar(r.obraId, user.id, "rubro.eliminar", r.nombre);
}

export async function crearItem(rubroId: string, fd: FormData) {
  const r = await db.query.rubros.findFirst({ where: eq(schema.rubros.id, rubroId) });
  if (!r) throw new Error("Rubro inexistente");
  const { user } = await assertObra(r.obraId, ["arquitecto"]);
  const nombre = String(fd.get("nombre") ?? "").trim();
  if (!nombre) return;
  const unidad = String(fd.get("unidad") ?? "gl").trim() || "gl";
  const cantidad = Number(String(fd.get("cantidad") ?? "0").replace(",", ".")) || 0;
  const [{ m }] = await db.select({ m: sql<number>`coalesce(max(orden),0)` }).from(schema.items).where(eq(schema.items.rubroId, rubroId));
  // por defecto sigue al último ítem del rubro
  const ultimo = await db.query.items.findFirst({ where: eq(schema.items.rubroId, rubroId), orderBy: (t, { desc }) => desc(t.orden) });
  await db.insert(schema.items).values({
    obraId: r.obraId,
    rubroId,
    orden: Number(m) + 1,
    nombre,
    unidad,
    cantidadCalc: 0,
    cantidadManual: cantidad,
    duracionManual: Number(fd.get("duracion")) || null,
    predecesoras: ultimo ? [{ id: ultimo.id, tipo: "FC", desfase: 0 }] : [],
  });
  await recalcularObra(r.obraId);
  await auditar(r.obraId, user.id, "item.crear", nombre);
  revalidatePath(`/obras/${r.obraId}`, "layout");
}

const itemPatch = z.object({
  nombre: z.string().trim().min(1).optional(),
  unidad: z.string().trim().min(1).optional(),
  cantidadManual: z.number().nonnegative().nullable().optional(),
  duracionManual: z.number().int().min(1).max(2000).nullable().optional(),
  asignadoA: z.string().nullable().optional(),
  notas: z.string().nullable().optional(),
  esHito: z.boolean().optional(),
});

export async function actualizarItem(itemId: string, patch: z.infer<typeof itemPatch>) {
  const it = await itemDeObra(itemId);
  const { user } = await assertObra(it.obraId, ["arquitecto"]);
  const p = itemPatch.parse(patch);
  await db.update(schema.items).set(p).where(eq(schema.items.id, itemId));
  if ("cantidadManual" in p || "duracionManual" in p || "esHito" in p) await recalcularObra(it.obraId);
  await auditar(it.obraId, user.id, "item.editar", `${it.nombre}: ${JSON.stringify(p)}`);
}

async function limpiarPredecesoras(obraId: string, idsEliminados: string[]) {
  const its = await db.query.items.findMany({ where: eq(schema.items.obraId, obraId) });
  for (const i of its) {
    const nuevas = (i.predecesoras ?? []).filter((p) => !idsEliminados.includes(p.id));
    if (nuevas.length !== (i.predecesoras ?? []).length) {
      // hereda las predecesoras del eliminado para no romper la secuencia
      const heredadas = its.filter((x) => idsEliminados.includes(x.id)).flatMap((x) => x.predecesoras ?? []).filter((p) => !idsEliminados.includes(p.id) && p.id !== i.id);
      const final = [...nuevas, ...heredadas.filter((h) => !nuevas.some((n) => n.id === h.id))];
      await db.update(schema.items).set({ predecesoras: final }).where(eq(schema.items.id, i.id));
    }
  }
}

export async function eliminarItem(itemId: string) {
  const it = await itemDeObra(itemId);
  const { user } = await assertObra(it.obraId, ["arquitecto"]);
  await limpiarPredecesoras(it.obraId, [itemId]);
  await db.delete(schema.items).where(eq(schema.items.id, itemId));
  await recalcularObra(it.obraId);
  await auditar(it.obraId, user.id, "item.eliminar", it.nombre);
}

export async function agregarPredecesora(itemId: string, fd: FormData) {
  const it = await itemDeObra(itemId);
  await assertObra(it.obraId, ["arquitecto"]);
  const predId = String(fd.get("predId") ?? "");
  const tipo = fd.get("tipo") === "CC" ? "CC" : "FC";
  const desfase = Math.round(Number(fd.get("desfase") ?? 0)) || 0;
  if (!predId || predId === itemId) return;
  const its = await db.query.items.findMany({ where: eq(schema.items.obraId, it.obraId) });
  if (!its.some((x) => x.id === predId)) throw new Error("Tarea inexistente");
  if (generaCiclo(its, itemId, predId)) throw new Error("Esa dependencia generaría un ciclo en el cronograma");
  const preds = (it.predecesoras ?? []).filter((p) => p.id !== predId);
  preds.push({ id: predId, tipo, desfase });
  await db.update(schema.items).set({ predecesoras: preds }).where(eq(schema.items.id, itemId));
  await recalcularObra(it.obraId);
  revalidatePath(`/obras/${it.obraId}`, "layout");
}

export async function quitarPredecesora(itemId: string, predId: string) {
  const it = await itemDeObra(itemId);
  await assertObra(it.obraId, ["arquitecto"]);
  await db.update(schema.items).set({ predecesoras: (it.predecesoras ?? []).filter((p) => p.id !== predId) }).where(eq(schema.items.id, itemId));
  await recalcularObra(it.obraId);
}

/** Gantt interactivo: mover (fija "no antes de") y cambiar duración. */
export async function moverEnGantt(itemId: string, nuevoInicio: string | null, nuevaDuracion?: number) {
  const it = await itemDeObra(itemId);
  const { user } = await assertObra(it.obraId, ["arquitecto"]);
  const set: Partial<typeof schema.items.$inferInsert> = {};
  if (nuevoInicio !== undefined) set.inicioMin = nuevoInicio ? ajustarHabil(nuevoInicio) : null;
  if (nuevaDuracion != null) set.duracionManual = Math.max(1, Math.round(nuevaDuracion));
  await db.update(schema.items).set(set).where(eq(schema.items.id, itemId));
  await recalcularObra(it.obraId);
  await auditar(it.obraId, user.id, "gantt.mover", `${it.nombre} → ${nuevoInicio ?? "auto"} / ${nuevaDuracion ?? "-"} d`);
}

export async function usarDuracionCalculada(itemId: string) {
  const it = await itemDeObra(itemId);
  await assertObra(it.obraId, ["arquitecto"]);
  await db.update(schema.items).set({ duracionManual: null }).where(eq(schema.items.id, itemId));
  await recalcularObra(it.obraId);
}

// ───────── Insumos y análisis de precios ─────────
export async function actualizarPrecio(insumoId: string, precio: number | null) {
  const ins = await db.query.insumos.findFirst({ where: eq(schema.insumos.id, insumoId) });
  if (!ins) throw new Error("Insumo inexistente");
  const { user } = await assertObra(ins.obraId, ["arquitecto"]);
  await db.update(schema.insumos).set({ precio: Math.max(0, precio ?? 0), precioActualizado: new Date() }).where(eq(schema.insumos.id, insumoId));
  await auditar(ins.obraId, user.id, "precio.editar", `${ins.nombre}: ${ins.precio} → ${precio}`);
}

export async function crearInsumo(obraId: string, fd: FormData) {
  await assertObra(obraId, ["arquitecto"]);
  const nombre = String(fd.get("nombre") ?? "").trim();
  const unidad = String(fd.get("unidad") ?? "").trim();
  const tipo = String(fd.get("tipo") ?? "material") as "material" | "mano_obra" | "equipo";
  if (!nombre || !unidad) return;
  await db.insert(schema.insumos).values({ obraId, nombre, unidad, tipo, precio: Number(String(fd.get("precio") ?? 0).replace(",", ".")) || 0 });
  revalidatePath(`/obras/${obraId}`, "layout");
}

/** Copia precios de otra obra del mismo arquitecto (por nombre de insumo). */
export async function copiarPreciosDe(obraId: string, origenId: string) {
  const { user } = await assertObra(obraId, ["arquitecto"]);
  await assertObra(origenId, ["arquitecto"]);
  const [dest, orig] = await Promise.all([
    db.query.insumos.findMany({ where: eq(schema.insumos.obraId, obraId) }),
    db.query.insumos.findMany({ where: eq(schema.insumos.obraId, origenId) }),
  ]);
  let n = 0;
  for (const d of dest) {
    const o = orig.find((x) => (x.clave && x.clave === d.clave) || x.nombre === d.nombre);
    if (o && o.precio > 0) {
      await db.update(schema.insumos).set({ precio: o.precio, precioActualizado: new Date() }).where(eq(schema.insumos.id, d.id));
      n++;
    }
  }
  await auditar(obraId, user.id, "precios.copiar", `${n} precios desde ${origenId}`);
  revalidatePath(`/obras/${obraId}`, "layout");
  return n;
}

export async function agregarRecurso(itemId: string, fd: FormData) {
  const it = await itemDeObra(itemId);
  await assertObra(it.obraId, ["arquitecto"]);
  const insumoId = String(fd.get("insumoId") ?? "");
  const consumo = Number(String(fd.get("consumo") ?? "").replace(",", "."));
  if (!insumoId || !(consumo > 0)) return;
  const ins = await db.query.insumos.findFirst({ where: and(eq(schema.insumos.id, insumoId), eq(schema.insumos.obraId, it.obraId)) });
  if (!ins) throw new Error("Insumo inválido");
  await db.insert(schema.recursos).values({ itemId, insumoId, consumo });
  await recalcularObra(it.obraId);
  revalidatePath(`/obras/${it.obraId}`, "layout");
}

export async function actualizarConsumo(recursoId: string, consumo: number | null) {
  const r = await db.query.recursos.findFirst({ where: eq(schema.recursos.id, recursoId) });
  if (!r) throw new Error("Recurso inexistente");
  const it = await itemDeObra(r.itemId);
  await assertObra(it.obraId, ["arquitecto"]);
  if (!consumo || consumo <= 0) await db.delete(schema.recursos).where(eq(schema.recursos.id, recursoId));
  else await db.update(schema.recursos).set({ consumo }).where(eq(schema.recursos.id, recursoId));
  await recalcularObra(it.obraId);
}

// ───────── Avances ─────────
export async function registrarAvance(obraId: string, _: FormState, fd: FormData): Promise<FormState> {
  const { user, rol, miembroId } = await assertObra(obraId, ["arquitecto", "obrero"]);
  const itemId = String(fd.get("itemId") ?? "");
  const it = await db.query.items.findFirst({ where: and(eq(schema.items.id, itemId), eq(schema.items.obraId, obraId)) });
  if (!it) return { error: "Elegí una tarea" };
  const tipo = fd.get("tipo") === "problema" ? "problema" : "avance";
  const pct = Math.max(0, Math.min(100, Number(fd.get("avancePct") ?? it.avanceReal)));
  const cantidad = fd.get("cantidad") ? Number(String(fd.get("cantidad")).replace(",", ".")) : null;
  const nota = String(fd.get("nota") ?? "").trim() || null;
  if (tipo === "problema" && !nota) return { error: "Describí el problema" };
  const fotos = await guardarArchivos(obraId, user.id, fd.getAll("fotos") as File[], { categoria: "foto" });
  await db.insert(schema.avances).values({ obraId, itemId, autorId: user.id, avancePct: tipo === "avance" ? pct : it.avanceReal, cantidad, nota, tipo, fotos });
  if (tipo === "avance") {
    await db
      .update(schema.items)
      .set({ avanceReal: pct, cantidadEjecutada: cantidad != null ? it.cantidadEjecutada + cantidad : it.cantidadEjecutada })
      .where(eq(schema.items.id, itemId));
  }
  const quien = rol === "obrero" ? "El encargado" : "El arquitecto";
  await notificar(
    obraId,
    tipo === "problema" ? ["arquitecto"] : ["arquitecto", "cliente"],
    tipo === "problema" ? `⚠ Problema informado en "${it.nombre}": ${nota}` : `${quien} informó ${pct}% de avance en "${it.nombre}"`,
    `/obras/${obraId}/seguimiento`,
    user.id,
    { whatsapp: tipo === "problema" },
  );
  await auditar(obraId, user.id, `avance.${tipo}`, `${it.nombre} ${pct}%`);
  revalidatePath(`/obras/${obraId}`, "layout");
  void miembroId;
  return { ok: tipo === "problema" ? "Problema informado al arquitecto." : "Avance registrado." };
}

// ───────── Equipo ─────────
export async function invitarMiembro(obraId: string, _: FormState, fd: FormData): Promise<FormState> {
  const { user, obra } = await assertObra(obraId, ["arquitecto"]);
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  const rol = String(fd.get("rol")) as "arquitecto" | "cliente" | "obrero";
  if (!z.string().email().safeParse(email).success) return { error: "Email inválido" };
  if (!["arquitecto", "cliente", "obrero"].includes(rol)) return { error: "Rol inválido" };
  const ms = await db.query.miembros.findMany({ where: eq(schema.miembros.obraId, obraId) });
  const owner = await db.query.users.findFirst({ where: eq(schema.users.id, obra.ownerId) });
  if (ms.length >= PLANES[owner!.plan].miembrosPorObra) return { error: "Alcanzaste el límite de miembros de tu plan." };
  if (ms.some((m) => m.email === email) || owner?.email === email) return { error: "Esa persona ya forma parte de la obra" };
  const u = await db.query.users.findFirst({ where: eq(schema.users.email, email) });
  await db.insert(schema.miembros).values({ obraId, email, rol, nombre: String(fd.get("nombre") ?? "").trim() || u?.nombre || null, oficio: String(fd.get("oficio") ?? "").trim() || null, userId: u?.id ?? null });
  if (u) await db.insert(schema.notificaciones).values({ userId: u.id, obraId, texto: `${user.nombre} te sumó a la obra "${obra.nombre}"`, link: `/obras/${obraId}` });
  const { enviarEmail, urlApp } = await import("@/lib/email");
  await enviarEmail({
    to: email,
    asunto: `${user.nombre} te invitó a la obra "${obra.nombre}"`,
    texto: `Hola${u ? ` ${u.nombre}` : ""}: ${user.nombre} te sumó a la obra "${obra.nombre}" en Obrapp como ${rol === "cliente" ? "cliente" : rol === "obrero" ? "parte del equipo de obra" : "arquitecto colaborador"}.${u ? "" : " Creá tu cuenta con este mismo email para ver la obra."}`,
    link: u ? `${urlApp()}/obras/${obraId}` : `${urlApp()}/registro`,
    linkTexto: u ? "Ver la obra" : "Crear mi cuenta",
  });
  await auditar(obraId, user.id, "equipo.invitar", `${email} (${rol})`);
  revalidatePath(`/obras/${obraId}/equipo`);
  return { ok: u ? "Miembro agregado." : "Invitación registrada: cuando se registre con ese email verá la obra." };
}

export async function quitarMiembro(miembroId: string) {
  const m = await db.query.miembros.findFirst({ where: eq(schema.miembros.id, miembroId) });
  if (!m) return;
  const { user } = await assertObra(m.obraId, ["arquitecto"]);
  await db.update(schema.items).set({ asignadoA: null }).where(and(eq(schema.items.obraId, m.obraId), eq(schema.items.asignadoA, miembroId)));
  await db.delete(schema.miembros).where(eq(schema.miembros.id, miembroId));
  await auditar(m.obraId, user.id, "equipo.quitar", m.email);
}

// ───────── Adicionales (aprobación del cliente) ─────────
export async function crearAdicional(obraId: string, _: FormState, fd: FormData): Promise<FormState> {
  const { user } = await assertObra(obraId, ["arquitecto"]);
  const titulo = String(fd.get("titulo") ?? "").trim();
  const monto = Number(String(fd.get("monto") ?? "").replace(",", "."));
  if (!titulo || !(monto > 0)) return { error: "Completá título y monto" };
  await db.insert(schema.adicionales).values({ obraId, titulo, monto, descripcion: String(fd.get("descripcion") ?? "").trim() || null });
  await notificar(obraId, ["cliente"], `Nuevo presupuesto adicional para aprobar: ${titulo}`, `/obras/${obraId}/presupuesto`, user.id);
  await auditar(obraId, user.id, "adicional.crear", `${titulo} $${monto}`);
  revalidatePath(`/obras/${obraId}/presupuesto`);
  return { ok: "Adicional enviado al cliente para su aprobación." };
}

export async function responderAdicional(adicionalId: string, estado: "aprobado" | "rechazado", respuesta?: string) {
  const a = await db.query.adicionales.findFirst({ where: eq(schema.adicionales.id, adicionalId) });
  if (!a) throw new Error("Adicional inexistente");
  const { user } = await assertObra(a.obraId, ["cliente"]);
  if (a.estado !== "pendiente") throw new Error("Este adicional ya fue respondido");
  await db.update(schema.adicionales).set({ estado, respuestaCliente: respuesta ?? null }).where(eq(schema.adicionales.id, adicionalId));
  await db.insert(schema.mensajes).values({ obraId: a.obraId, canal: "cliente", autorId: user.id, tipo: "decision", texto: `${estado === "aprobado" ? "Aprobé" : "Rechacé"} el adicional "${a.titulo}"${respuesta ? `: ${respuesta}` : ""}` });
  await notificar(a.obraId, ["arquitecto"], `El cliente ${estado === "aprobado" ? "aprobó" : "rechazó"} el adicional "${a.titulo}"`, `/obras/${a.obraId}/presupuesto`, user.id);
  await auditar(a.obraId, user.id, `adicional.${estado}`, a.titulo);
}

// ───────── Notificaciones y plan ─────────
export async function marcarNotificacionesLeidas() {
  const user = await requireUser();
  await db.update(schema.notificaciones).set({ leida: true }).where(eq(schema.notificaciones.userId, user.id));
  revalidatePath("/", "layout");
}

export async function cambiarPlan(plan: "gratuito" | "profesional" | "estudio") {
  const user = await requireUser();
  const { iniciarSuscripcion, cancelarSuscripcion } = await import("@/lib/pagos");
  await auditar(null, user.id, "plan.cambiar", plan);
  if (plan === "gratuito") {
    await cancelarSuscripcion(user.id);
    revalidatePath("/configuracion");
    return;
  }
  const r = await iniciarSuscripcion(user, plan);
  revalidatePath("/configuracion");
  if (r.url) redirect(r.url); // checkout de Mercado Pago
}

// Variantes con firma (id, valor) para edición en línea desde la tabla
export async function setCantidadManual(itemId: string, v: number | null) {
  await actualizarItem(itemId, { cantidadManual: v });
}
export async function setDuracionManual(itemId: string, v: number | null) {
  await actualizarItem(itemId, { duracionManual: v == null ? null : Math.max(1, Math.round(v)) });
}
export async function setNombreItem(itemId: string, v: string) {
  await actualizarItem(itemId, { nombre: v });
}

// ───────── Cambios pedidos por el cliente (web o WhatsApp) ─────────
export async function evaluarCambio(cambioId: string, _: FormState, fd: FormData): Promise<FormState> {
  const c = await db.query.cambios.findFirst({ where: eq(schema.cambios.id, cambioId) });
  if (!c) return { error: "Cambio inexistente" };
  const { user } = await assertObra(c.obraId, ["arquitecto"]);
  const monto = Number(String(fd.get("impactoMonto") ?? "").replace(",", "."));
  const dias = Math.round(Number(fd.get("impactoDias") ?? 0)) || 0;
  const respuesta = String(fd.get("respuesta") ?? "").trim() || null;
  if (fd.get("rechazar") === "1") {
    await db.update(schema.cambios).set({ estado: "rechazado", respuestaArquitecto: respuesta }).where(eq(schema.cambios.id, cambioId));
    await notificar(c.obraId, ["cliente"], `El arquitecto respondió tu pedido de cambio: ${respuesta ?? "no es viable"}`, `/obras/${c.obraId}/presupuesto`, user.id);
    revalidatePath(`/obras/${c.obraId}/presupuesto`);
    return { ok: "Respuesta enviada." };
  }
  if (isNaN(monto)) return { error: "Indicá el impacto económico (puede ser 0 o negativo si es un ahorro)" };
  const [ad] = await db.insert(schema.adicionales).values({
    obraId: c.obraId,
    titulo: `Cambio: ${c.descripcion.slice(0, 70)}`,
    descripcion: `${respuesta ?? ""}${dias ? `\nImpacto en plazo: ${dias > 0 ? "+" : ""}${dias} días hábiles.` : "\nSin impacto en plazo."}`.trim(),
    monto,
  }).returning();
  await db.update(schema.cambios).set({ estado: "evaluado", impactoMonto: monto, impactoDias: dias, respuestaArquitecto: respuesta, adicionalId: ad.id }).where(eq(schema.cambios.id, cambioId));
  await notificar(c.obraId, ["cliente"], `Tu pedido de cambio fue evaluado: ${monto >= 0 ? "+" : ""}$${Math.round(monto).toLocaleString("es-AR")}${dias ? ` y ${dias} días` : ""}. Respondé "qué tengo pendiente" para aprobarlo.`, `/obras/${c.obraId}/presupuesto`, user.id);
  await auditar(c.obraId, user.id, "cambio.evaluar", `${c.descripcion.slice(0, 80)}: $${monto}, ${dias} d`);
  revalidatePath(`/obras/${c.obraId}/presupuesto`);
  return { ok: "Propuesta enviada al cliente para su aprobación." };
}

export async function setAvisosEmail(valor: boolean) {
  const user = await requireUser();
  await db.update(schema.users).set({ avisosEmail: valor }).where(eq(schema.users.id, user.id));
  revalidatePath("/configuracion");
}

// ───────── Importar planillas existentes (XLSX / CSV) ─────────
export async function previsualizarPlanilla(obraId: string, fd: FormData) {
  await assertObra(obraId, ["arquitecto"]);
  const f = fd.get("archivo") as File | null;
  if (!f || !f.size) return { filas: [], advertencias: ["Elegí un archivo .xlsx o .csv"] };
  if (f.size > 5 * 1024 * 1024) return { filas: [], advertencias: ["El archivo supera 5 MB"] };
  const { leerPlanilla } = await import("@/lib/planillas");
  try {
    return await leerPlanilla(f);
  } catch {
    return { filas: [], advertencias: ["No pude leer el archivo. Guardalo como .xlsx o .csv e intentá de nuevo."] };
  }
}

export async function importarPlanilla(obraId: string, filas: { rubro: string; nombre: string; unidad: string; cantidad: number; precio: number | null; duracion: number | null }[], modo: "agregar" | "reemplazar") {
  const { user } = await assertObra(obraId, ["arquitecto"]);
  const validas = filas.filter((f) => f && typeof f.nombre === "string" && f.nombre.trim()).slice(0, 500);
  if (!validas.length) throw new Error("No hay filas para importar");
  if (modo === "reemplazar") await db.delete(schema.rubros).where(eq(schema.rubros.obraId, obraId));
  const existentes = await db.query.rubros.findMany({ where: eq(schema.rubros.obraId, obraId) });
  let orden = existentes.reduce((m, r) => Math.max(m, r.orden), 0);
  const ultimoItemPrevio = modo === "agregar" ? (await db.query.items.findMany({ where: eq(schema.items.obraId, obraId) })).sort((a, b) => (b.fin ?? "").localeCompare(a.fin ?? ""))[0] : undefined;
  let anterior: string | null = ultimoItemPrevio?.id ?? null;
  const porRubro = new Map<string, string>();
  for (const [k, f] of validas.entries()) {
    let rubroId = porRubro.get(f.rubro) ?? existentes.find((r) => r.nombre.toLowerCase() === f.rubro.toLowerCase())?.id;
    if (!rubroId) {
      orden++;
      const [r] = await db.insert(schema.rubros).values({ obraId, nombre: f.rubro.slice(0, 120), orden, codigo: String(orden).padStart(2, "0") }).returning();
      rubroId = r.id;
    }
    porRubro.set(f.rubro, rubroId);
    const [it] = await db.insert(schema.items).values({
      obraId, rubroId, orden: k + 1, nombre: f.nombre.slice(0, 200), unidad: (f.unidad || "gl").slice(0, 20),
      cantidadCalc: 0, cantidadManual: Math.max(0, Number(f.cantidad) || 0), duracionManual: f.duracion && f.duracion > 0 ? Math.round(f.duracion) : null,
      predecesoras: anterior ? [{ id: anterior, tipo: "FC", desfase: 0 }] : [],
    }).returning();
    anterior = it.id;
    if (f.precio != null && f.precio > 0) {
      const [ins] = await db.insert(schema.insumos).values({ obraId, tipo: "material", nombre: `${f.nombre.slice(0, 150)} (precio global importado)`, unidad: it.unidad, precio: f.precio, precioActualizado: new Date() }).returning();
      await db.insert(schema.recursos).values({ itemId: it.id, insumoId: ins.id, consumo: 1 });
    }
  }
  await recalcularObra(obraId);
  await auditar(obraId, user.id, "planilla.importar", `${validas.length} ítems (${modo})`);
  revalidatePath(`/obras/${obraId}`, "layout");
  return validas.length;
}
