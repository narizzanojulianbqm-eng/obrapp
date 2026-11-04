import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";
import * as schema from "./schema";
import { dbEnv } from "./env";

const globalForDb = globalThis as unknown as { __db?: ReturnType<typeof drizzle<typeof schema>> };

function make() {
  const { url, authToken } = dbEnv();
  const client = createClient({ url, authToken });
  return drizzle(client, { schema });
}

export const db = globalForDb.__db ?? make();
if (process.env.NODE_ENV !== "production") globalForDb.__db = db;
export { schema };
