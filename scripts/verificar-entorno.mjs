// Se ejecuta antes del build en Vercel: frena el despliegue con un mensaje claro si falta configuración.
const faltan = [];
if (process.env.VERCEL) {
  const hayBase = Object.keys(process.env).some((k) => /DATABASE_URL$/.test(k) && /^libsql:\/\//.test(process.env[k] ?? ""));
  console.log("Variables de base detectadas:", Object.keys(process.env).filter((k) => /DATABASE|TURSO|LIBSQL/.test(k)).join(", ") || "ninguna");
  if (!hayBase) faltan.push("Base de datos: conectá Turso en Vercel → Storage (crea TURSO_DATABASE_URL y TURSO_AUTH_TOKEN)");
  if (!process.env.AUTH_SECRET) faltan.push("AUTH_SECRET: agregalo en Settings → Environment Variables (un texto largo y aleatorio)");
}
if (faltan.length) {
  console.error("\n✖ Falta configuración para desplegar Obrapp:\n  - " + faltan.join("\n  - ") + "\n");
  process.exit(1);
}
console.log("✓ Entorno verificado");
