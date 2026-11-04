/**
 * Resuelve la conexión a la base. Acepta DATABASE_URL/DATABASE_AUTH_TOKEN, TURSO_DATABASE_URL/TURSO_AUTH_TOKEN
 * o cualquier par con prefijo (p. ej. STORAGE_TURSO_DATABASE_URL) que crea la integración de Vercel.
 */
export function dbEnv(env: Record<string, string | undefined> = process.env) {
  let url = env.DATABASE_URL || env.TURSO_DATABASE_URL;
  let token = env.DATABASE_AUTH_TOKEN || env.TURSO_AUTH_TOKEN;
  if (!url) {
    const k = Object.keys(env).find((k) => /DATABASE_URL$/.test(k) && /^libsql:\/\//.test(env[k] ?? ""));
    if (k) {
      url = env[k];
      const pref = k.replace(/DATABASE_URL$/, "");
      token = token || env[`${pref}AUTH_TOKEN`] || env[`${pref}DATABASE_AUTH_TOKEN`];
    }
  }
  if (!token) {
    const t = Object.keys(env).find((k) => /AUTH_TOKEN$/.test(k) && /TURSO|DATABASE|LIBSQL/.test(k));
    if (t) token = env[t];
  }
  return { url: url || "file:data/obrapp.db", authToken: token || undefined, remota: !!url };
}
