/**
 * Lee un presupuesto/cómputo escrito como texto (PDF con texto, Word, foto pasada por OCR o texto pegado)
 * y lo convierte en filas de rubros e ítems. Es heurístico: el usuario revisa la vista previa antes de cargar.
 */
import { parseMonto } from "../format";

export type FilaImportada = { rubro: string; nombre: string; unidad: string; cantidad: number; precio: number | null; duracion: number | null };

const UNIDADES: Record<string, string> = {
  m2: "m2", "m²": "m2", mts2: "m2", mt2: "m2", "m2.": "m2",
  m3: "m3", "m³": "m3", mts3: "m3", mt3: "m3",
  ml: "ml", "m.l": "ml", "m.l.": "ml", mlin: "ml", m: "ml", mts: "ml",
  kg: "kg", kgs: "kg", tn: "tn", t: "tn",
  u: "u", un: "u", und: "u", unid: "u", unidad: "u", uni: "u", "u.": "u", pza: "u", pzas: "u", nro: "u", "n°": "u", cu: "u",
  gl: "gl", glb: "gl", global: "gl", "gl.": "gl",
  bolsa: "bolsa", bolsas: "bolsa", l: "l", lt: "l", lts: "l", litros: "l",
  hs: "h", h: "h", hora: "h", horas: "h", dia: "día", dias: "día", "día": "día", "días": "día",
  boca: "boca", bocas: "boca", local: "local", locales: "local", "baño": "baño", ban: "baño", mes: "mes", ha: "ha",
};
export function normalizarUnidad(u: string): string | null {
  const k = u.toLowerCase().replace(/[()]/g, "").trim();
  return UNIDADES[k] ?? UNIDADES[k.replace(/\.$/, "")] ?? null;
}

const esNumero = (t: string) => /^\$?-?\d[\d.,]*%?$/.test(t.replace(/^\$/, "")) && /\d/.test(t);
const IGNORAR = /^(sub\s*-?\s*total|total|iva|i\.v\.a|importe|presupuesto|cliente|obra:|fecha|p[aá]gina|hoja|item\b.*descrip|descripci[oó]n\b.*(unid|cant)|nota|observaciones|validez|forma de pago|son pesos|beneficio|gastos generales|honorarios)/i;
const capitalizar = (s: string) => (s === s.toUpperCase() && /[A-ZÁÉÍÓÚÑ]/.test(s) ? s.charAt(0) + s.slice(1).toLowerCase() : s);
const limpiarNombre = (s: string) => s.replace(/^[\s\-–•·*]*((\d+[.,)]?)+\s*|[a-z]\)\s+)/i, "").replace(/[\s.:;\-–$]+$/, "").replace(/\s{2,}/g, " ").trim();

/** Interpreta una línea de ítem: "<nombre> <unidad> <cantidad> [<precio unit> [<total>]]". */
export function interpretarLinea(linea: string): Omit<FilaImportada, "rubro" | "duracion"> | null {
  const toks = linea.replace(/\$\s+/g, "$").split(/\s+/).filter(Boolean);
  // última unidad reconocida seguida de al menos un número
  for (let i = toks.length - 2; i >= 1; i--) {
    const u = normalizarUnidad(toks[i]);
    if (!u || !esNumero(toks[i + 1])) continue;
    const nombre = limpiarNombre(toks.slice(0, i).join(" "));
    if (!/[a-záéíóúñ]{3,}/i.test(nombre)) continue;
    const nums = toks.slice(i + 1).filter(esNumero).map((t) => parseMonto(t.replace(/^\$/, "")));
    const cantidad = nums[0] ?? 0;
    let precio: number | null = null;
    if (nums.length >= 3) {
      // cantidad, unitario, total: si cierra la cuenta, perfecto; si no, igual tomamos el segundo
      precio = nums[1];
      if (cantidad > 0 && Math.abs(cantidad * nums[1] - nums[2]) > Math.max(1, nums[2] * 0.03) && Math.abs(nums[2] / cantidad - nums[1]) > nums[1] * 0.03) {
        const unit = nums[2] / cantidad;
        if (cantidad > 0 && Math.abs(cantidad * nums[2] - nums[1]) < nums[1] * 0.03) precio = nums[2];
        else if (unit > 0 && nums[1] > nums[2]) precio = nums[2];
      }
    } else if (nums.length === 2) precio = nums[1];
    return { nombre, unidad: u, cantidad, precio: precio && precio > 0 ? precio : null };
  }
  return null;
}

/** Convierte un texto completo en filas, detectando títulos de rubro. */
export function filasDesdeTexto(texto: string): { filas: FilaImportada[]; advertencias: string[] } {
  const lineas = texto.replace(/\r/g, "").split("\n").map((l) => l.replace(/\t/g, " ").replace(/\s{2,}/g, " ").trim()).filter(Boolean);
  const filas: FilaImportada[] = [];
  let rubro = "Varios";
  let pendiente = ""; // nombre partido en dos líneas
  for (const l of lineas) {
    if (IGNORAR.test(l)) { pendiente = ""; continue; }
    const it = interpretarLinea(l) ?? (pendiente ? interpretarLinea(`${pendiente} ${l}`) : null);
    if (it) {
      if (pendiente && !interpretarLinea(l)) pendiente = "";
      filas.push({ rubro, ...it, duracion: null });
      pendiente = "";
      continue;
    }
    const sinNum = l.replace(/^[\d.,)\-\s]+/, "");
    const tieneMonto = /\d{3,}/.test(sinNum.replace(/\d+\s*(cm|mm|x\d+)/gi, ""));
    // título de rubro: corto, con letras, sin montos
    if (!tieneMonto && /[a-záéíóúñ]{3,}/i.test(sinNum) && sinNum.length <= 60 && sinNum.split(" ").length <= 8) {
      const esTitulo = /^\d{1,2}[.)\-\s]/.test(l) || sinNum === sinNum.toUpperCase() || /^(rubro|cap[ií]tulo|etapa)\b/i.test(sinNum);
      if (esTitulo) { rubro = capitalizar(sinNum.replace(/^(rubro|cap[ií]tulo|etapa)\s*[:\-\d.]*\s*/i, "").trim()) || rubro; pendiente = ""; continue; }
      pendiente = sinNum;
      continue;
    }
    pendiente = "";
  }
  const advertencias: string[] = [];
  if (!filas.length) advertencias.push("No reconocí ítems con unidad y cantidad en el texto. Revisá que cada línea tenga descripción, unidad (m2, m3, ml, u, gl…) y cantidad.");
  else if (filas.some((f) => !f.cantidad)) advertencias.push(`${filas.filter((f) => !f.cantidad).length} ítems vienen sin cantidad.`);
  return { filas: filas.slice(0, 500), advertencias };
}
