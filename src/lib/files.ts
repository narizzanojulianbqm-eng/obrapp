import "server-only";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { eq } from "drizzle-orm";
import { db, schema } from "./db";

export const UPLOAD_DIR = process.env.UPLOAD_DIR ?? path.join(process.cwd(), "data", "uploads");
/** En Vercel no hay disco persistente: los archivos se guardan en la base (Turso). En local, en disco. */
export const almacenamientoEnBase = () => process.env.STORAGE === "db" || (process.env.STORAGE !== "disk" && !!process.env.VERCEL);
/** Vercel limita el cuerpo de cada request a ~4,5 MB (las fotos se comprimen en el navegador antes de subir). */
export const MAX_BYTES = almacenamientoEnBase() ? 4 * 1024 * 1024 : 12 * 1024 * 1024;

export async function guardarArchivos(
  obraId: string,
  userId: string,
  files: File[],
  opts: { categoria?: string; visibleCliente?: boolean; visibleObrero?: boolean } = {},
): Promise<string[]> {
  const validos = files.filter((f) => f && typeof f === "object" && f.size > 0);
  if (!validos.length) return [];
  const enBase = almacenamientoEnBase();
  if (!enBase) await mkdir(path.join(UPLOAD_DIR, obraId), { recursive: true });
  const ids: string[] = [];
  for (const f of validos) {
    if (f.size > MAX_BYTES) throw new Error(`"${f.name}" supera los ${Math.round(MAX_BYTES / 1024 / 1024)} MB`);
    const id = crypto.randomUUID();
    const seguro = f.name.replace(/[^\w.\-]+/g, "_").slice(-80);
    const ruta = enBase ? `db:${id}` : path.join(obraId, `${id}-${seguro}`);
    const buf = Buffer.from(await f.arrayBuffer());
    await db.insert(schema.documentos).values({
      id, obraId, subidoPor: userId, nombre: f.name, ruta, mime: f.type || null, tamano: f.size,
      categoria: opts.categoria ?? (f.type.startsWith("image/") ? "foto" : "general"),
      visibleCliente: opts.visibleCliente ?? true, visibleObrero: opts.visibleObrero ?? true,
    });
    if (enBase) await db.insert(schema.archivosContenido).values({ docId: id, data: buf });
    else await writeFile(path.join(UPLOAD_DIR, ruta), buf);
    ids.push(id);
  }
  return ids;
}

export async function leerArchivo(doc: { id: string; ruta: string }): Promise<Buffer | null> {
  if (doc.ruta.startsWith("db:")) {
    const r = await db.query.archivosContenido.findFirst({ where: eq(schema.archivosContenido.docId, doc.id) });
    return r ? Buffer.from(r.data) : null;
  }
  const file = path.resolve(UPLOAD_DIR, doc.ruta);
  if (!file.startsWith(path.resolve(UPLOAD_DIR))) return null;
  try { return await readFile(file); } catch { return null; }
}
