/** Normaliza teléfonos argentinos al formato que usa WhatsApp (wa_id): 549 + área + número, sin 0 ni 15. */
export function normalizarTelefono(raw: string): string | null {
  let d = raw.replace(/\D/g, "");
  if (!d) return null;
  if (d.startsWith("00")) d = d.slice(2);
  if (d.startsWith("54")) {
    d = d.slice(2);
    if (d.startsWith("9")) d = d.slice(1);
  } else if (d.length > 11 && !d.startsWith("0")) {
    return d.length >= 8 && d.length <= 15 ? d : null; // número internacional no argentino
  }
  if (d.startsWith("0")) d = d.slice(1);
  // quitar el "15" después del código de área (2 a 4 dígitos)
  for (const area of [2, 3, 4]) {
    if (d.length === 12 && d.slice(area, area + 2) === "15") { d = d.slice(0, area) + d.slice(area + 2); break; }
  }
  if (d.length !== 10) return null;
  return "549" + d;
}

export const telefonoLegible = (wa: string) => (wa.startsWith("549") && wa.length === 13 ? `+54 9 ${wa.slice(3, 5)} ${wa.slice(5, 9)}-${wa.slice(9)}` : `+${wa}`);
