import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";
import * as schema from "./schema";

const globalForDb = globalThis as unknown as { __db?: ReturnType<typeof drizzle<typeof schema>> };

function make() {
  const client = createClient({
    // Turso (integración de Vercel) define TURSO_DATABASE_URL / TURSO_AUTH_TOKEN
    url: process.env.DATABASE_URL || process.env.TURSO_DATABASE_URL || "file:data/obrapp.db",
    authToken: process.env.DATABASE_AUTH_TOKEN || process.env.TURSO_AUTH_TOKEN || undefined,
  });
  return drizzle(client, { schema });
}

export const db = globalForDb.__db ?? make();
if (process.env.NODE_ENV !== "production") globalForDb.__db = db;
export { schema };
