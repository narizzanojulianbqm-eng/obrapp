import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { getUser } from "@/lib/auth";
import { rolEnObra } from "@/lib/access";
import { leerArchivo } from "@/lib/files";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getUser();
  if (!user) return new Response("No autorizado", { status: 401 });
  const doc = await db.query.documentos.findFirst({ where: eq(schema.documentos.id, id) });
  if (!doc) return new Response("No encontrado", { status: 404 });
  const acceso = await rolEnObra(user.id, user.email, doc.obraId);
  if (!acceso) return new Response("No encontrado", { status: 404 });
  if ((acceso.rol === "cliente" && !doc.visibleCliente) || (acceso.rol === "obrero" && !doc.visibleObrero)) return new Response("No autorizado", { status: 403 });
  const buf = await leerArchivo(doc);
  if (!buf) return new Response("Archivo no disponible", { status: 404 });
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": doc.mime ?? "application/octet-stream",
      "Content-Disposition": `${doc.mime?.startsWith("image/") || doc.mime === "application/pdf" ? "inline" : "attachment"}; filename="${encodeURIComponent(doc.nombre)}"`,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
