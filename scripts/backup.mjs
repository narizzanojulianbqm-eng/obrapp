// Copia de seguridad: base de datos (copia consistente con VACUUM INTO) + archivos subidos.
// Uso: node scripts/backup.mjs  (programarlo diario con cron). Conserva las últimas 14 copias.
// En producción con Turso, además conviene usar los backups automáticos de la plataforma.
import { createClient } from "@libsql/client";
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import path from "node:path";

const dir = process.env.BACKUP_DIR ?? "backups";
const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const destino = path.join(dir, stamp);
mkdirSync(destino, { recursive: true });
const url = process.env.DATABASE_URL ?? "file:data/obrapp.db";
if (url.startsWith("file:")) {
  const db = createClient({ url });
  await db.execute(`VACUUM INTO '${path.join(destino, "obrapp.db").replace(/'/g, "''")}'`);
  console.log("Base copiada");
} else console.log("Base remota (Turso): usar los backups de la plataforma");
const uploads = process.env.UPLOAD_DIR ?? "data/uploads";
if (existsSync(uploads)) { cpSync(uploads, path.join(destino, "uploads"), { recursive: true }); console.log("Archivos copiados"); }
const copias = readdirSync(dir).sort();
for (const viejo of copias.slice(0, Math.max(0, copias.length - 14))) rmSync(path.join(dir, viejo), { recursive: true, force: true });
console.log("Backup listo en", destino);
