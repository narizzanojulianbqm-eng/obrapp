import "server-only";
import { eq } from "drizzle-orm";
import { db, schema } from "./db";

const MAX_FALLOS = 5;
const BLOQUEO_MIN = 15;

/** Devuelve los minutos de bloqueo restantes (0 si puede intentar). */
export async function minutosBloqueado(clave: string): Promise<number> {
  const r = await db.query.intentosAcceso.findFirst({ where: eq(schema.intentosAcceso.clave, clave) });
  if (!r?.bloqueadoHasta) return 0;
  const ms = r.bloqueadoHasta.getTime() - Date.now();
  return ms > 0 ? Math.ceil(ms / 60000) : 0;
}

export async function registrarFallo(clave: string) {
  const r = await db.query.intentosAcceso.findFirst({ where: eq(schema.intentosAcceso.clave, clave) });
  // los fallos viejos (más de 1 h) no cuentan
  const previos = r && r.actualizado && Date.now() - r.actualizado.getTime() < 3600000 ? r.fallos : 0;
  const fallos = previos + 1;
  const bloqueadoHasta = fallos >= MAX_FALLOS ? new Date(Date.now() + BLOQUEO_MIN * 60000) : null;
  if (r) await db.update(schema.intentosAcceso).set({ fallos: bloqueadoHasta ? 0 : fallos, bloqueadoHasta, actualizado: new Date() }).where(eq(schema.intentosAcceso.clave, clave));
  else await db.insert(schema.intentosAcceso).values({ clave, fallos, bloqueadoHasta, actualizado: new Date() });
}

export async function limpiarFallos(clave: string) {
  await db.delete(schema.intentosAcceso).where(eq(schema.intentosAcceso.clave, clave));
}
