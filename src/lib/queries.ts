import "server-only";
import { and, desc, eq, inArray, or, sql } from "drizzle-orm";
import { db, schema } from "./db";
import type { Rol } from "./db/schema";
import { cargarObra, costosReales } from "./obra-service";
import { avanceGeneral, calcularPresupuesto, itemsAtrasados } from "./engine/calculos";
import { diagnosticar } from "./engine/diagnostico";

export async function obrasDelUsuario(user: { id: string; email: string }) {
  const propias = await db.query.obras.findMany({ where: eq(schema.obras.ownerId, user.id), orderBy: desc(schema.obras.createdAt) });
  const ms = await db.query.miembros.findMany({ where: or(eq(schema.miembros.userId, user.id), eq(schema.miembros.email, user.email)) });
  const ajenasIds = ms.map((m) => m.obraId).filter((id) => !propias.some((p) => p.id === id));
  const ajenas = ajenasIds.length ? await db.query.obras.findMany({ where: inArray(schema.obras.id, ajenasIds) }) : [];
  return [
    ...propias.map((o) => ({ obra: o, rol: "arquitecto" as Rol, miembroId: null as string | null })),
    ...ajenas.map((o) => ({ obra: o, rol: ms.find((m) => m.obraId === o.id)!.rol as Rol, miembroId: ms.find((m) => m.obraId === o.id)!.id as string | null })),
  ];
}

export async function noLeidas(userId: string) {
  const [{ n }] = await db.select({ n: sql<number>`count(*)` }).from(schema.notificaciones).where(and(eq(schema.notificaciones.userId, userId), eq(schema.notificaciones.leida, false)));
  return Number(n);
}

/** Resumen completo (presupuesto, avance, alertas) de una obra. */
export async function resumenObra(obraId: string) {
  const obra = (await db.query.obras.findFirst({ where: eq(schema.obras.id, obraId) }))!;
  const datos = await cargarObra(obraId);
  const presupuesto = calcularPresupuesto(obra, datos.rubros, datos.items, datos.recursos, datos.insumos);
  const pesos = new Map<string, number>();
  presupuesto.rubros.forEach((r) => r.items.forEach((x) => pesos.set(x.item.id, x.parcial)));
  const avance = avanceGeneral(datos.items, pesos);
  const reales = await costosReales(obraId);
  const solicitudesPendientes = await db.query.solicitudes.findMany({ where: and(eq(schema.solicitudes.obraId, obraId), eq(schema.solicitudes.estado, "pendiente")) });
  const alertas = diagnosticar({ obra, ...datos, presupuesto, costoRealPorRubro: reales.porRubro, solicitudesPendientes });
  return { obra, ...datos, presupuesto, avance, reales, solicitudesPendientes, alertas, atrasados: itemsAtrasados(datos.items), pesos };
}
