export const ars = (n: number | null | undefined, dec = 0) =>
  n == null || isNaN(n) ? "—" : n.toLocaleString("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: dec, minimumFractionDigits: dec });
export const num = (n: number | null | undefined, dec = 2) =>
  n == null || isNaN(n) ? "—" : n.toLocaleString("es-AR", { maximumFractionDigits: dec, minimumFractionDigits: 0 });
export const pct = (n: number | null | undefined, dec = 1) => (n == null || isNaN(n) ? "—" : `${n.toLocaleString("es-AR", { maximumFractionDigits: dec })}%`);
export const fechaHora = (d: Date | number) =>
  new Date(d).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/Argentina/Buenos_Aires" });
export const ROL_LABEL = { arquitecto: "Arquitecto", cliente: "Cliente", obrero: "Obrero / encargado" } as const;

/** Interpreta montos escritos a la argentina ("11.500,50", "11500", "11,5") o con punto decimal ("11500.5"). */
export function parseMonto(v: unknown): number {
  let t = String(v ?? "").trim().replace(/[$\s]/g, "");
  if (!t) return 0;
  if (t.includes(",")) t = t.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, "");
  const n = Number(t);
  return isNaN(n) ? 0 : n;
}
