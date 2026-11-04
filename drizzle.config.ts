import { defineConfig } from "drizzle-kit";
import { dbEnv } from "./src/lib/db/env";
const { url, authToken } = dbEnv();
export default defineConfig({ schema: "./src/lib/db/schema.ts", out: "./drizzle", dialect: "turso", dbCredentials: { url, authToken } });
