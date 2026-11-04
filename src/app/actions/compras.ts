"use server";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db, schema } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { assertObra, auditar, notificar } from "@/lib/access";
import { guardarArchivos } from "@/lib/files";
import { hoyISO } from "@/lib/engine/calendario";
import { mensajeCotizacion } from "@/lib/integraciones";
import { parseMonto } from "@/lib/format";
import type { FormState } from "./auth";

// ───────── Solicitudes de materiales ─────────
const solicitudSchema = z.object({
  tipo: z.enum(["material", "herramienta"]).default("material"),
  material: z.string().trim().min(2, "Indicá qué material o herramienta necesitás"),
  cantidad: z.coerce.number().positive("La cantidad debe ser mayor a 0"),
  unidad: z.string().trim().min(1, "Indicá la unidad"),
  fechaNecesaria: z.preprocess((v) => v || undefined, z.string().optional()),
  itemId: z.preprocess((v) => v || undefined, z.string().optional()),
  insumoId: z.preprocess((v) => v || undefined, z.string().optional()),
  observaciones: z.preprocess((v) => v || undefined, z.string().optional()),
  prioridad: z.enum(["baja", "media", "alta", "urgente"]).default("media"),
});

export async function crearSolicitud(obraId: string, _: FormState, fd: FormData): Promise<FormState> {
  const { user } = await assertObra(obraId, ["arquitecto", "obrero"]);
  const p = solicitudSchema.safeParse(Object.fromEntries([...fd.entries()].filter(([k]) => k !== "fotos")));
  if (!p.success) return { error: p.error.issues[0].message };
  if (p.data.itemId) {
    const it = await db.query.items.findFirst({ where: and(eq(schema.items.id, p.data.itemId), eq(schema.items.obraId, obraId)) });
    if (!it) return { error: "Tarea inválida" };
  }
  let insumoId = p.data.insumoId;
  if (!insumoId) {
    const ins = await db.query.insumos.findFirst({ where: and(eq(schema.insumos.obraId, obraId), eq(schema.insumos.nombre, p.data.material)) });
    insumoId = ins?.id;
  }
  const fotos = await guardarArchivos(obraId, user.id, fd.getAll("fotos") as File[], { categoria: "foto" });
  await db.insert(schema.solicitudes).values({ ...p.data, insumoId, obraId, solicitanteId: user.id, fotos });
  await notificar(obraId, ["arquitecto"], `${user.nombre} solicitó ${p.data.cantidad} ${p.data.unidad} de ${p.data.material}${p.data.prioridad === "urgente" ? " (URGENTE)" : ""}`, `/obras/${obraId}/solicitudes`, user.id);
  await auditar(obraId, user.id, "solicitud.crear", p.data.material);
  revalidatePath(`/obras/${obraId}`, "layout");
  return { ok: "Solicitud enviada al arquitecto." };
}

export async function responderSolicitud(solicitudId: string, estado: "aprobada" | "rechazada" | "entregada", respuesta?: string, cantidad?: number) {
  const s = await db.query.solicitudes.findFirst({ where: eq(schema.solicitudes.id, solicitudId) });
  if (!s) throw new Error("Solicitud inexistente");
  const { user } = await assertObra(s.obraId, ["arquitecto"]);
  await db
    .update(schema.solicitudes)
    .set({ estado, respuesta: respuesta ?? s.respuesta, cantidad: cantidad && cantidad > 0 ? cantidad : s.cantidad })
    .where(eq(schema.solicitudes.id, solicitudId));
  const sol = await db.query.users.findFirst({ where: eq(schema.users.id, s.solicitanteId) });
  if (sol && sol.id !== user.id)
    await db.insert(schema.notificaciones).values({ userId: sol.id, obraId: s.obraId, texto: `Tu solicitud de ${s.material} fue ${estado}${respuesta ? `: ${respuesta}` : ""}`, link: `/obras/${s.obraId}/solicitudes` });
  await auditar(s.obraId, user.id, `solicitud.${estado}`, s.material);
}

/** Convierte una solicitud aprobada en compra (vinculada a rubro, insumo y presupuesto). */
export async function convertirEnCompra(solicitudId: string, _: FormState, fd: FormData): Promise<FormState> {
  const s = await db.query.solicitudes.findFirst({ where: eq(schema.solicitudes.id, solicitudId) });
  if (!s) return { error: "Solicitud inexistente" };
  const { user } = await assertObra(s.obraId, ["arquitecto"]);
  const precio = Number(String(fd.get("precioUnitario") ?? "").replace(",", "."));
  if (!(precio >= 0)) return { error: "Precio inválido" };
  const proveedorId = String(fd.get("proveedorId") ?? "") || null;
  const requiereCliente = fd.get("requiereAprobacionCliente") === "on";
  const it = s.itemId ? await db.query.items.findFirst({ where: eq(schema.items.id, s.itemId) }) : null;
  await db.insert(schema.compras).values({
    obraId: s.obraId,
    proveedorId,
    solicitudId: s.id,
    insumoId: s.insumoId,
    rubroId: it?.rubroId ?? (String(fd.get("rubroId") ?? "") || null),
    descripcion: s.material,
    cantidad: s.cantidad,
    unidad: s.unidad,
    precioUnitario: precio,
    total: precio * s.cantidad,
    fecha: hoyISO(),
    estado: requiereCliente ? "prevista" : "pedida",
    requiereAprobacionCliente: requiereCliente,
    aprobacionCliente: requiereCliente ? "pendiente" : null,
  });
  await db.update(schema.solicitudes).set({ estado: "en_compra" }).where(eq(schema.solicitudes.id, s.id));
  if (fd.get("actualizarPrecio") === "on" && s.insumoId && precio > 0)
    await db.update(schema.insumos).set({ precio, precioActualizado: new Date() }).where(eq(schema.insumos.id, s.insumoId));
  if (requiereCliente) await notificar(s.obraId, ["cliente"], `Compra para aprobar: ${s.cantidad} ${s.unidad} de ${s.material}`, `/obras/${s.obraId}/compras`, user.id);
  await auditar(s.obraId, user.id, "solicitud.compra", `${s.material} $${precio * s.cantidad}`);
  revalidatePath(`/obras/${s.obraId}`, "layout");
  return { ok: "Compra registrada." };
}

// ───────── Compras ─────────
export async function crearCompra(obraId: string, _: FormState, fd: FormData): Promise<FormState> {
  const { user } = await assertObra(obraId, ["arquitecto"]);
  const descripcion = String(fd.get("descripcion") ?? "").trim();
  const cantidad = Number(String(fd.get("cantidad") ?? "1").replace(",", ".")) || 1;
  const precio = Number(String(fd.get("precioUnitario") ?? "").replace(",", "."));
  if (!descripcion || !(precio >= 0)) return { error: "Completá descripción y precio" };
  const requiereCliente = fd.get("requiereAprobacionCliente") === "on";
  await db.insert(schema.compras).values({
    obraId,
    descripcion,
    cantidad,
    unidad: String(fd.get("unidad") ?? "u") || "u",
    precioUnitario: precio,
    total: precio * cantidad,
    proveedorId: String(fd.get("proveedorId") ?? "") || null,
    rubroId: String(fd.get("rubroId") ?? "") || null,
    insumoId: String(fd.get("insumoId") ?? "") || null,
    fecha: String(fd.get("fecha") ?? "") || hoyISO(),
    estado: (String(fd.get("estado") ?? "pedida") as "prevista" | "pedida" | "recibida" | "pagada"),
    pagado: Number(String(fd.get("pagado") ?? "0").replace(",", ".")) || 0,
    requiereAprobacionCliente: requiereCliente,
    aprobacionCliente: requiereCliente ? "pendiente" : null,
  });
  if (requiereCliente) await notificar(obraId, ["cliente"], `Compra para aprobar: ${descripcion}`, `/obras/${obraId}/compras`, user.id);
  await auditar(obraId, user.id, "compra.crear", `${descripcion} $${precio * cantidad}`);
  revalidatePath(`/obras/${obraId}`, "layout");
  return { ok: "Compra registrada." };
}

export async function actualizarCompra(compraId: string, patch: { estado?: "prevista" | "pedida" | "recibida" | "pagada"; pagado?: number }) {
  const c = await db.query.compras.findFirst({ where: eq(schema.compras.id, compraId) });
  if (!c) throw new Error("Compra inexistente");
  const { user } = await assertObra(c.obraId, ["arquitecto"]);
  if (c.requiereAprobacionCliente && c.aprobacionCliente !== "aprobada" && patch.estado && patch.estado !== "prevista")
    throw new Error("Esta compra espera la aprobación del cliente");
  const set: Partial<typeof schema.compras.$inferInsert> = {};
  if (patch.estado) set.estado = patch.estado;
  if (patch.estado === "pagada") set.pagado = c.total;
  if (patch.pagado != null) set.pagado = Math.max(0, patch.pagado);
  await db.update(schema.compras).set(set).where(eq(schema.compras.id, compraId));
  if (patch.estado === "recibida" && c.solicitudId) await db.update(schema.solicitudes).set({ estado: "entregada" }).where(eq(schema.solicitudes.id, c.solicitudId));
  await auditar(c.obraId, user.id, "compra.editar", `${c.descripcion}: ${JSON.stringify(patch)}`);
}

export async function aprobarCompraCliente(compraId: string, aprobada: boolean) {
  const c = await db.query.compras.findFirst({ where: eq(schema.compras.id, compraId) });
  if (!c) throw new Error("Compra inexistente");
  const { user } = await assertObra(c.obraId, ["cliente"]);
  await db.update(schema.compras).set({ aprobacionCliente: aprobada ? "aprobada" : "rechazada", estado: aprobada ? "pedida" : "prevista" }).where(eq(schema.compras.id, compraId));
  await notificar(c.obraId, ["arquitecto"], `El cliente ${aprobada ? "aprobó" : "rechazó"} la compra "${c.descripcion}"`, `/obras/${c.obraId}/compras`, user.id);
  await auditar(c.obraId, user.id, aprobada ? "compra.aprobar" : "compra.rechazar", c.descripcion);
  if (aprobada && c.respuestaId) await liberarPedidoSiAprobado(c.respuestaId);
}

export async function eliminarCompra(compraId: string) {
  const c = await db.query.compras.findFirst({ where: eq(schema.compras.id, compraId) });
  if (!c) return;
  const { user } = await assertObra(c.obraId, ["arquitecto"]);
  await db.delete(schema.compras).where(eq(schema.compras.id, compraId));
  await auditar(c.obraId, user.id, "compra.eliminar", `${c.descripcion} $${c.total}`);
}

// ───────── Proveedores ─────────
const provSchema = z.object({
  nombre: z.string().trim().min(2, "Nombre requerido"),
  rubro: z.string().trim().optional(),
  localidad: z.string().trim().optional(),
  direccion: z.string().trim().optional(),
  telefono: z.string().trim().optional(),
  whatsapp: z.string().trim().optional(),
  email: z.preprocess((v) => v || undefined, z.string().trim().email("Email inválido").optional()),
  canal: z.enum(["email", "whatsapp", "telefono", "api", "catalogo"]).default("email"),
  notas: z.string().trim().optional(),
});

export async function guardarProveedor(id: string | null, _: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  const p = provSchema.safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: p.error.issues[0].message };
  if (id) {
    const prov = await db.query.proveedores.findFirst({ where: and(eq(schema.proveedores.id, id), eq(schema.proveedores.ownerId, user.id)) });
    if (!prov) return { error: "Proveedor inexistente" };
    await db.update(schema.proveedores).set(p.data).where(eq(schema.proveedores.id, id));
  } else {
    await db.insert(schema.proveedores).values({ ...p.data, ownerId: user.id });
  }
  revalidatePath("/proveedores");
  return { ok: "Proveedor guardado." };
}

export async function eliminarProveedor(id: string) {
  const user = await requireUser();
  const usado = await db.query.respuestasCotizacion.findFirst({ where: eq(schema.respuestasCotizacion.proveedorId, id) });
  if (usado) throw new Error("El proveedor tiene cotizaciones registradas; no se puede eliminar.");
  await db.delete(schema.proveedores).where(and(eq(schema.proveedores.id, id), eq(schema.proveedores.ownerId, user.id)));
  revalidatePath("/proveedores");
}

// ───────── Cotizaciones ─────────
export async function crearCotizacion(obraId: string, _: FormState, fd: FormData): Promise<FormState> {
  const { user, obra } = await assertObra(obraId, ["arquitecto"]);
  const insumoIds = fd.getAll("insumoId").map(String);
  const lineas: { insumoId?: string; descripcion: string; cantidad: number; unidad: string }[] = [];
  for (const iid of insumoIds) {
    const ins = await db.query.insumos.findFirst({ where: and(eq(schema.insumos.id, iid), eq(schema.insumos.obraId, obraId)) });
    const cant = Number(String(fd.get(`cant_${iid}`) ?? "0").replace(",", "."));
    if (ins && cant > 0) lineas.push({ insumoId: ins.id, descripcion: ins.nombre, cantidad: cant, unidad: ins.unidad });
  }
  if (!lineas.length) return { error: "Seleccioná al menos un material con cantidad" };
  const provIds = fd.getAll("proveedorId").map(String);
  const [c] = await db
    .insert(schema.cotizaciones)
    .values({ obraId, titulo: String(fd.get("titulo") ?? "").trim() || `Pedido de cotización ${obra.nombre}`, lineas, estado: provIds.length ? "enviada" : "borrador" })
    .returning();
  for (const pid of provIds) {
    const prov = await db.query.proveedores.findFirst({ where: and(eq(schema.proveedores.id, pid), eq(schema.proveedores.ownerId, obra.ownerId)) });
    if (prov) await db.insert(schema.respuestasCotizacion).values({ cotizacionId: c.id, proveedorId: prov.id, canalEnvio: prov.canal, precios: lineas.map(() => 0) });
  }
  await auditar(obraId, user.id, "cotizacion.crear", `${lineas.length} líneas, ${provIds.length} proveedores`);
  revalidatePath(`/obras/${obraId}/cotizaciones`);
  return { ok: "Pedido de cotización creado." };
}

export async function agregarProveedorCotizacion(cotizacionId: string, proveedorId: string) {
  const c = await db.query.cotizaciones.findFirst({ where: eq(schema.cotizaciones.id, cotizacionId) });
  if (!c) throw new Error("Cotización inexistente");
  const { obra } = await assertObra(c.obraId, ["arquitecto"]);
  const prov = await db.query.proveedores.findFirst({ where: and(eq(schema.proveedores.id, proveedorId), eq(schema.proveedores.ownerId, obra.ownerId)) });
  if (!prov) throw new Error("Proveedor inválido");
  await db.insert(schema.respuestasCotizacion).values({ cotizacionId, proveedorId, canalEnvio: prov.canal, precios: c.lineas.map(() => 0) });
  await db.update(schema.cotizaciones).set({ estado: "enviada" }).where(eq(schema.cotizaciones.id, cotizacionId));
}

export async function cargarRespuestaCotizacion(respuestaId: string, _: FormState, fd: FormData): Promise<FormState> {
  const r = await db.query.respuestasCotizacion.findFirst({ where: eq(schema.respuestasCotizacion.id, respuestaId) });
  if (!r) return { error: "Respuesta inexistente" };
  const c = (await db.query.cotizaciones.findFirst({ where: eq(schema.cotizaciones.id, r.cotizacionId) }))!;
  await assertObra(c.obraId, ["arquitecto"]);
  const precios = c.lineas.map((_, i) => Math.max(0, Number(String(fd.get(`precio_${i}`) ?? "0").replace(",", ".")) || 0));
  await db
    .update(schema.respuestasCotizacion)
    .set({
      precios,
      envio: Number(String(fd.get("envio") ?? "0").replace(",", ".")) || 0,
      plazoEntregaDias: Number(fd.get("plazoEntregaDias")) || null,
      condicionesPago: String(fd.get("condicionesPago") ?? "").trim() || null,
      disponibilidad: String(fd.get("disponibilidad") ?? "").trim() || null,
      estado: "recibida",
      respondidaPor: "arquitecto",
      respondidaEn: new Date(),
    })
    .where(eq(schema.respuestasCotizacion.id, respuestaId));
  revalidatePath(`/obras/${c.obraId}/cotizaciones`);
  return { ok: "Respuesta cargada." };
}

/** Elegir la mejor oferta: genera las compras (requiere confirmación explícita del arquitecto en la UI). */
export async function elegirRespuesta(respuestaId: string, requiereCliente: boolean, actualizarPrecios: boolean) {
  const r = await db.query.respuestasCotizacion.findFirst({ where: eq(schema.respuestasCotizacion.id, respuestaId) });
  if (!r) throw new Error("Respuesta inexistente");
  const c = (await db.query.cotizaciones.findFirst({ where: eq(schema.cotizaciones.id, r.cotizacionId) }))!;
  const { user } = await assertObra(c.obraId, ["arquitecto"]);
  const prov = await db.query.proveedores.findFirst({ where: eq(schema.proveedores.id, r.proveedorId) });
  // rubro sugerido: el del primer ítem que usa el insumo
  for (const [i, l] of c.lineas.entries()) {
    const precio = r.precios[i] ?? 0;
    let rubroId: string | null = null;
    if (l.insumoId) {
      const rec = await db.query.recursos.findFirst({ where: eq(schema.recursos.insumoId, l.insumoId) });
      if (rec) rubroId = (await db.query.items.findFirst({ where: eq(schema.items.id, rec.itemId) }))?.rubroId ?? null;
      if (actualizarPrecios && precio > 0) await db.update(schema.insumos).set({ precio, precioActualizado: new Date() }).where(eq(schema.insumos.id, l.insumoId));
    }
    await db.insert(schema.compras).values({
      obraId: c.obraId,
      proveedorId: r.proveedorId,
      respuestaId: r.id,
      insumoId: l.insumoId ?? null,
      rubroId,
      descripcion: l.descripcion,
      cantidad: l.cantidad,
      unidad: l.unidad,
      precioUnitario: precio,
      total: precio * l.cantidad,
      fecha: hoyISO(),
      estado: requiereCliente ? "prevista" : "pedida",
      requiereAprobacionCliente: requiereCliente,
      aprobacionCliente: requiereCliente ? "pendiente" : null,
    });
  }
  if (r.envio > 0)
    await db.insert(schema.compras).values({ obraId: c.obraId, proveedorId: r.proveedorId, respuestaId: r.id, descripcion: `Flete ${prov?.nombre ?? ""}`.trim(), cantidad: 1, unidad: "gl", precioUnitario: r.envio, total: r.envio, fecha: hoyISO(), estado: requiereCliente ? "prevista" : "pedida", requiereAprobacionCliente: requiereCliente, aprobacionCliente: requiereCliente ? "pendiente" : null });
  await db.update(schema.respuestasCotizacion).set({ estado: "descartada" }).where(eq(schema.respuestasCotizacion.cotizacionId, c.id));
  await db.update(schema.respuestasCotizacion).set({ estado: "elegida", estadoPedido: requiereCliente ? "sin_pedido" : "enviado" }).where(eq(schema.respuestasCotizacion.id, r.id));
  if (!requiereCliente) await avisarPedidoAlProveedor(r.id);
  await db.update(schema.cotizaciones).set({ estado: "cerrada" }).where(eq(schema.cotizaciones.id, c.id));
  if (requiereCliente) await notificar(c.obraId, ["cliente"], `Hay compras de "${prov?.nombre}" esperando tu aprobación`, `/obras/${c.obraId}/compras`, user.id);
  await auditar(c.obraId, user.id, "cotizacion.elegir", prov?.nombre);
}

export async function textoCotizacion(respuestaId: string) {
  const r = await db.query.respuestasCotizacion.findFirst({ where: eq(schema.respuestasCotizacion.id, respuestaId) });
  if (!r) throw new Error("Respuesta inexistente");
  const c = (await db.query.cotizaciones.findFirst({ where: eq(schema.cotizaciones.id, r.cotizacionId) }))!;
  const { obra, user } = await assertObra(c.obraId, ["arquitecto"]);
  const prov = (await db.query.proveedores.findFirst({ where: eq(schema.proveedores.id, r.proveedorId) }))!;
  const { urlApp } = await import("@/lib/email");
  return mensajeCotizacion({ obra, proveedor: prov, lineas: c.lineas, firmante: user.nombre, link: `${urlApp()}/cotizar/${r.token}` });
}

export async function _subirFotos(obraId: string, fd: FormData) {
  const { user } = await assertObra(obraId);
  return guardarArchivos(obraId, user.id, fd.getAll("fotos") as File[]);
}

export async function setEstadoCompra(compraId: string, estado: "prevista" | "pedida" | "recibida" | "pagada") {
  await actualizarCompra(compraId, { estado });
}

// ───────── Portal de proveedores (link con token, sin registro) ─────────
export async function liberarPedidoSiAprobado(respuestaId: string) {
  const cs = await db.query.compras.findMany({ where: eq(schema.compras.respuestaId, respuestaId) });
  if (cs.length && cs.every((x) => x.aprobacionCliente !== "pendiente")) {
    await db.update(schema.respuestasCotizacion).set({ estadoPedido: "enviado" }).where(eq(schema.respuestasCotizacion.id, respuestaId));
    await avisarPedidoAlProveedor(respuestaId);
  }
}

/** Avisa al proveedor elegido (email si tiene) que tiene un pedido para confirmar en su link. */
async function avisarPedidoAlProveedor(respuestaId: string) {
  const r = await db.query.respuestasCotizacion.findFirst({ where: eq(schema.respuestasCotizacion.id, respuestaId) });
  if (!r) return;
  const prov = await db.query.proveedores.findFirst({ where: eq(schema.proveedores.id, r.proveedorId) });
  const c = await db.query.cotizaciones.findFirst({ where: eq(schema.cotizaciones.id, r.cotizacionId) });
  const obra = c ? await db.query.obras.findFirst({ where: eq(schema.obras.id, c.obraId) }) : null;
  if (!prov?.email || !obra) return;
  const { enviarEmail, urlApp } = await import("@/lib/email");
  await enviarEmail({ to: prov.email, asunto: `Pedido confirmado – ${obra.nombre}`, texto: `Hola ${prov.nombre}: elegimos su cotización para la obra "${obra.nombre}". Por favor confirme el pedido y la fecha de entrega en el link.`, link: `${urlApp()}/cotizar/${r.token}`, linkTexto: "Ver y confirmar pedido" });
}

async function respuestaPorToken(token: string) {
  if (!/^[a-f0-9]{32}$/.test(token)) return null;
  const r = await db.query.respuestasCotizacion.findFirst({ where: eq(schema.respuestasCotizacion.token, token) });
  if (!r) return null;
  const c = (await db.query.cotizaciones.findFirst({ where: eq(schema.cotizaciones.id, r.cotizacionId) }))!;
  return { r, c };
}

export async function responderComoProveedor(token: string, _: FormState, fd: FormData): Promise<FormState> {
  const x = await respuestaPorToken(token);
  if (!x) return { error: "Link inválido" };
  const { r, c } = x;
  if (c.estado === "cerrada") return { error: "Esta cotización ya fue cerrada." };
  const precios = c.lineas.map((_, i) => Math.max(0, parseMonto(fd.get(`precio_${i}`))));
  if (!precios.some((p) => p > 0)) return { error: "Cargá al menos un precio" };
  await db
    .update(schema.respuestasCotizacion)
    .set({
      precios,
      envio: Math.max(0, parseMonto(fd.get("envio"))),
      plazoEntregaDias: Number(fd.get("plazoEntregaDias")) || null,
      condicionesPago: String(fd.get("condicionesPago") ?? "").trim().slice(0, 300) || null,
      disponibilidad: String(fd.get("disponibilidad") ?? "").trim().slice(0, 300) || null,
      notasProveedor: String(fd.get("notas") ?? "").trim().slice(0, 1000) || null,
      estado: "recibida",
      respondidaPor: "proveedor",
      respondidaEn: new Date(),
    })
    .where(eq(schema.respuestasCotizacion.id, r.id));
  const prov = await db.query.proveedores.findFirst({ where: eq(schema.proveedores.id, r.proveedorId) });
  await notificar(c.obraId, ["arquitecto"], `${prov?.nombre ?? "Un proveedor"} respondió la cotización "${c.titulo}"`, `/obras/${c.obraId}/cotizaciones`);
  await auditar(c.obraId, null, "cotizacion.respuesta_proveedor", prov?.nombre);
  return { ok: "¡Gracias! Recibimos su cotización. Le avisaremos si es elegida." };
}

export async function confirmarPedidoProveedor(token: string, _: FormState, fd: FormData): Promise<FormState> {
  const x = await respuestaPorToken(token);
  if (!x) return { error: "Link inválido" };
  const { r, c } = x;
  if (r.estado !== "elegida" || r.estadoPedido !== "enviado") return { error: "No hay un pedido pendiente de confirmación." };
  const fecha = String(fd.get("fechaEntrega") ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return { error: "Indicá la fecha de entrega" };
  await db.update(schema.respuestasCotizacion).set({ estadoPedido: "confirmado", fechaEntrega: fecha }).where(eq(schema.respuestasCotizacion.id, r.id));
  const prov = await db.query.proveedores.findFirst({ where: eq(schema.proveedores.id, r.proveedorId) });
  await notificar(c.obraId, ["arquitecto", "obrero"], `${prov?.nombre} confirmó el pedido. Entrega prevista: ${fecha.split("-").reverse().join("/")}`, `/obras/${c.obraId}/compras`);
  await auditar(c.obraId, null, "pedido.confirmado_proveedor", `${prov?.nombre} ${fecha}`);
  return { ok: "Pedido confirmado. ¡Gracias!" };
}

export async function confirmarEntregaProveedor(token: string, _: FormState, fd: FormData): Promise<FormState> {
  const x = await respuestaPorToken(token);
  if (!x) return { error: "Link inválido" };
  const { r, c } = x;
  if (r.estadoPedido !== "confirmado") return { error: "Primero hay que confirmar el pedido." };
  await db.update(schema.respuestasCotizacion).set({ estadoPedido: "entregado", notasProveedor: [r.notasProveedor, String(fd.get("remito") ?? "").trim() && `Remito: ${fd.get("remito")}`].filter(Boolean).join(" · ") || null }).where(eq(schema.respuestasCotizacion.id, r.id));
  const cs = await db.query.compras.findMany({ where: eq(schema.compras.respuestaId, r.id) });
  for (const co of cs) {
    if (co.estado === "pedida" || co.estado === "prevista") await db.update(schema.compras).set({ estado: "recibida" }).where(eq(schema.compras.id, co.id));
    if (co.solicitudId) await db.update(schema.solicitudes).set({ estado: "entregada" }).where(eq(schema.solicitudes.id, co.solicitudId));
  }
  // solicitudes de esos insumos que estaban en compra
  const ins = cs.map((x) => x.insumoId).filter(Boolean) as string[];
  if (ins.length) {
    const sols = await db.query.solicitudes.findMany({ where: and(eq(schema.solicitudes.obraId, c.obraId), eq(schema.solicitudes.estado, "aprobada")) });
    for (const s of sols) if (s.insumoId && ins.includes(s.insumoId)) await db.update(schema.solicitudes).set({ estado: "entregada", respuesta: "Entregado por el proveedor" }).where(eq(schema.solicitudes.id, s.id));
  }
  const prov = await db.query.proveedores.findFirst({ where: eq(schema.proveedores.id, r.proveedorId) });
  await notificar(c.obraId, ["arquitecto", "obrero"], `📦 ${prov?.nombre} informó la entrega del pedido en obra (${cs.length} ítems). Verificar cantidades al recibir.`, `/obras/${c.obraId}/compras`);
  await auditar(c.obraId, null, "pedido.entregado_proveedor", prov?.nombre);
  return { ok: "Entrega registrada. ¡Gracias!" };
}

/** Envía el pedido de cotización por email a todos los proveedores de la cotización que tengan email. */
export async function enviarCotizacionPorEmail(cotizacionId: string) {
  const c = await db.query.cotizaciones.findFirst({ where: eq(schema.cotizaciones.id, cotizacionId) });
  if (!c) throw new Error("Cotización inexistente");
  const { obra, user } = await assertObra(c.obraId, ["arquitecto"]);
  const { enviarEmail, urlApp } = await import("@/lib/email");
  const rs = await db.query.respuestasCotizacion.findMany({ where: eq(schema.respuestasCotizacion.cotizacionId, c.id) });
  let n = 0;
  for (const r of rs.filter((x) => x.estado === "pendiente")) {
    const prov = await db.query.proveedores.findFirst({ where: eq(schema.proveedores.id, r.proveedorId) });
    if (!prov?.email) continue;
    const link = `${urlApp()}/cotizar/${r.token}`;
    const msg = mensajeCotizacion({ obra, proveedor: prov, lineas: c.lineas, firmante: user.nombre, link });
    const res = await enviarEmail({ to: prov.email, asunto: msg.asunto, texto: msg.cuerpo, link, linkTexto: "Cargar cotización" });
    if (res.ok) { n++; await db.update(schema.respuestasCotizacion).set({ enviadaEn: new Date(), canalEnvio: "email" }).where(eq(schema.respuestasCotizacion.id, r.id)); }
  }
  await auditar(c.obraId, user.id, "cotizacion.enviar_email", `${n} proveedores`);
  revalidatePath(`/obras/${c.obraId}/cotizaciones`);
  return n;
}

export async function marcarEnviada(respuestaId: string, canal: string) {
  const r = await db.query.respuestasCotizacion.findFirst({ where: eq(schema.respuestasCotizacion.id, respuestaId) });
  if (!r) return;
  const c = (await db.query.cotizaciones.findFirst({ where: eq(schema.cotizaciones.id, r.cotizacionId) }))!;
  await assertObra(c.obraId, ["arquitecto"]);
  await db.update(schema.respuestasCotizacion).set({ enviadaEn: new Date(), canalEnvio: canal }).where(eq(schema.respuestasCotizacion.id, respuestaId));
}
