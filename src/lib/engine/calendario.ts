// Calendario de días hábiles (lunes a viernes). Fechas como strings YYYY-MM-DD en hora local neutra (UTC).

export function parse(d: string): Date {
  const [y, m, day] = d.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, day));
}
export function fmt(d: Date): string {
  return d.toISOString().slice(0, 10);
}
export function hoyISO(): string {
  const now = new Date();
  return fmt(new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())));
}
const esHabil = (d: Date) => d.getUTCDay() !== 0 && d.getUTCDay() !== 6;

/** Si la fecha cae en fin de semana, avanza al próximo hábil. */
export function ajustarHabil(s: string): string {
  const d = parse(s);
  while (!esHabil(d)) d.setUTCDate(d.getUTCDate() + 1);
  return fmt(d);
}

/** Suma n días hábiles (n puede ser negativo). sumarHabiles(x, 0) = x ajustado. */
export function sumarHabiles(s: string, n: number): string {
  const d = parse(ajustarHabil(s));
  const paso = n >= 0 ? 1 : -1;
  let restantes = Math.abs(n);
  while (restantes > 0) {
    d.setUTCDate(d.getUTCDate() + paso);
    if (esHabil(d)) restantes--;
  }
  return fmt(d);
}

/** Cantidad de días hábiles entre a (incluido) y b (excluido). Negativo si b es anterior a a. */
export function habilesEntre(a: string, b: string): number {
  const ta = parse(a).getTime(), tb = parse(b).getTime();
  if (!(ta === ta) || !(tb === tb) || ta === tb) return 0; // fechas inválidas o iguales
  const signo = tb > ta ? 1 : -1;
  const d = new Date(Math.min(ta, tb));
  const fin = Math.max(ta, tb);
  let n = 0;
  while (d.getTime() < fin) {
    if (esHabil(d)) n++;
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return signo * n;
}

export function diasCorridos(a: string, b: string): number {
  return Math.round((parse(b).getTime() - parse(a).getTime()) / 86400000);
}

export function fechaLarga(s: string | null | undefined): string {
  if (!s) return "—";
  return parse(s).toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
}
export function fechaCorta(s: string | null | undefined): string {
  if (!s) return "—";
  return parse(s).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", timeZone: "UTC" });
}
