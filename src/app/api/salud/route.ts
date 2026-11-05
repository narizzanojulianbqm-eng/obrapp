import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { dbEnv } from "@/lib/db/env";

export const dynamic = "force-dynamic";

/** Diagnóstico público mínimo: no expone credenciales ni datos, solo si la base es remota y su antigüedad. */
export async function GET() {
  const { url, remota } = dbEnv();
  const host = (() => { try { return new URL(url).host; } catch { return url; } })();
  const [{ n, desde }] = await db.select({ n: sql<number>`count(*)`, desde: sql<number>`min(${schema.users.createdAt})` }).from(schema.users);
  return NextResponse.json({
    ok: true,
    base: remota ? "remota" : "local",
    huellaBase: createHash("sha256").update(host).digest("hex").slice(0, 10),
    variables: Object.keys(process.env).filter((k) => /DATABASE|TURSO|LIBSQL/.test(k)),
    usuarios: Number(n),
    baseCreada: desde ? new Date(Number(desde) * 1000).toISOString() : null,
    despliegue: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
  });
}
