/** Utilidades de lenguaje natural (sin IA) para mensajes informales de obra en español rioplatense. */
import type { Item, Insumo } from "../db/schema";

export function normalizar(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9%.,\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export const esSi = (t: string) => /^(si|sí|s|dale|ok|okey|confirmo|confirmar|de una|perfecto|correcto|listo|yes)\b/.test(normalizar(t));
export const esNo = (t: string) => /^(no|n|cancelar|cancela|nop|negativo|para)\b/.test(normalizar(t));

/** Sinónimos de obra → palabras que aparecen en los nombres de ítems / rubros. */
const SINONIMOS: Record<string, string[]> = {
  pared: ["muro", "mamposteria", "tabique", "ladrillo"],
  paredes: ["muro", "mamposteria", "tabique", "ladrillo"],
  muros: ["muro", "mamposteria"],
  levantar: ["mamposteria", "muro"],
  hormigonado: ["hormigon", "losa", "columna", "viga", "platea", "fundacion"],
  hormigonamos: ["hormigon", "losa", "columna", "viga", "platea"],
  colado: ["hormigon", "losa"],
  llenado: ["hormigon", "losa"],
  losa: ["losa", "entrepiso"],
  cimiento: ["fundacion", "cimiento", "zanja", "platea"],
  cimientos: ["fundacion", "cimiento", "zanja", "platea"],
  pozo: ["excavacion", "zanja"],
  zanjeo: ["excavacion", "zanja"],
  electricidad: ["electrica", "tablero", "bocas"],
  luz: ["electrica", "llaves", "iluminacion"],
  cables: ["electrica"],
  caneria: ["sanitaria", "gas", "agua"],
  canerias: ["sanitaria", "gas"],
  agua: ["sanitaria"],
  cloaca: ["sanitaria", "desague"],
  desague: ["sanitaria"],
  gas: ["gas"],
  revoque: ["revoque"],
  revocar: ["revoque"],
  grueso: ["revoque"],
  fino: ["revoque"],
  contrapiso: ["contrapiso"],
  carpeta: ["carpeta"],
  ceramica: ["revestimiento", "ceramico"],
  ceramicos: ["revestimiento", "ceramico"],
  azulejos: ["revestimiento"],
  porcelanato: ["piso", "porcelanato"],
  piso: ["piso"],
  pisos: ["piso"],
  zocalo: ["zocalo"],
  techo: ["cubierta", "membrana", "losa"],
  membrana: ["cubierta", "membrana"],
  cielorraso: ["cielorraso"],
  durlock: ["placa", "yeso", "cielorraso"],
  pintura: ["pintura", "latex"],
  pintar: ["pintura", "latex"],
  ventanas: ["ventana"],
  aberturas: ["ventana", "puerta", "carpinteria"],
  puertas: ["puerta"],
  bano: ["sanitaria", "revestimiento", "artefactos"],
  banos: ["sanitaria", "revestimiento", "artefactos"],
  cocina: ["mesada", "revestimiento", "gas"],
  limpieza: ["limpieza"],
  replanteo: ["replanteo"],
  obrador: ["obrador"],
  steel: ["perfiles", "paneles"],
  placas: ["placa", "osb"],
};

const STOP = new Set(["hoy", "ayer", "manana", "terminamos", "termine", "termino", "de", "la", "el", "los", "las", "del", "con", "que", "en", "un", "una", "ya", "esta", "estamos", "vamos", "por", "para", "como", "quedo", "te", "mando", "foto", "fotos", "nos", "falta", "faltan", "y", "a", "al", "lo", "se", "mi", "su", "es", "son"]);

/** Puntaje de coincidencia entre un texto libre y los ítems de la obra. Prioriza tareas en curso. */
export function matchItems(texto: string, items: Item[], hoy: string): { item: Item; score: number }[] {
  const t = normalizar(texto);
  const palabras = t.split(" ").filter((w) => w.length > 2 && !STOP.has(w));
  const claves = new Set<string>();
  for (const w of palabras) {
    claves.add(w.length > 5 ? w.slice(0, w.length - 1) : w); // tolera plural / errores de tipeo al final
    for (const s of SINONIMOS[w] ?? []) claves.add(s);
  }
  if (!claves.size) return [];
  return items
    .filter((i) => !i.esHito)
    .map((i) => {
      const n = normalizar(i.nombre);
      let score = 0;
      for (const k of claves) if (k.length > 2 && n.includes(k)) score += k.length > 5 ? 2 : 1;
      if (score > 0) {
        if (i.inicio && i.inicio <= hoy && (i.fin ?? "") >= hoy) score += 1.5; // en curso
        else if (i.inicio && i.fin && i.fin < hoy && i.avanceReal < 100) score += 1; // vencida sin terminar
        if (i.avanceReal >= 100) score -= 1;
      }
      return { item: i, score };
    })
    .filter((x) => x.score >= 1.5)
    .sort((a, b) => b.score - a.score);
}

const UNIDADES: Record<string, string> = {
  bolsa: "bolsa", bolsas: "bolsa", bls: "bolsa", m3: "m3", metros3: "m3", "metros cubicos": "m3", m2: "m2", "metros cuadrados": "m2",
  kg: "kg", kilos: "kg", kilo: "kg", u: "u", unidades: "u", unidad: "u", ml: "ml", metros: "m", m: "m", litros: "l", l: "l", lts: "l",
  varillas: "u", barras: "u", rollos: "u", latas: "u", baldes: "u", camion: "u", camiones: "u", pallets: "u", pallet: "u",
};

/** Extrae pedidos de materiales: "nos faltan 20 bolsas de cemento y 2 m3 de arena para mañana". */
export function extraerMateriales(texto: string, insumos: Insumo[]): { material: string; cantidad: number; unidad: string; insumo?: Insumo }[] {
  const t = normalizar(texto).replace(/(\d),(\d)/g, "$1.$2");
  const res: { material: string; cantidad: number; unidad: string; insumo?: Insumo }[] = [];
  const re = /(\d+(?:\.\d+)?)\s*(?:(bolsas?|bls|m3|m2|kg|kilos?|unidades|unidad|u|ml|metros cubicos|metros cuadrados|metros|m|litros|lts|l|varillas|barras|rollos|latas|baldes|camion(?:es)?|pallets?)\b)?\s*(?:de\s+)?([a-z][a-z0-9 ]{2,40}?)(?=\s*(?:,|\by\b|\bpara\b|\bpor\b|\bque\b|\bmanana\b|\bhoy\b|$|\.))/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(t))) {
    const cantidad = Number(m[1]);
    let unidad = m[2] ? UNIDADES[m[2]] ?? m[2] : "";
    let material = m[3].trim().replace(/^(de|del)\s+/, "");
    if (!cantidad || material.length < 3 || /^(dias?|horas?|personas?|semanas?|%|por ciento|obreros?|tipos?)\b/.test(material)) continue;
    if (UNIDADES[material] || UNIDADES[material.replace(/s$/, "")]) {
      // "se terminó el adhesivo, necesito 5 bolsas": el material está antes del número
      if (!unidad) unidad = UNIDADES[material] ?? UNIDADES[material.replace(/s$/, "")];
      const antes = t.slice(0, m.index).split(" ").filter((w) => w.length > 3).slice(-4).join(" ");
      material = antes;
      if (!mejorInsumo(material, insumos)) continue;
    }
    const ins = mejorInsumo(material, insumos);
    if (!unidad) unidad = ins?.unidad ?? "u";
    res.push({ material: ins?.nombre ?? capital(material), cantidad, unidad, insumo: ins });
  }
  return res;
}

const SIN_MAT: Record<string, string> = { hierro: "acero", hierros: "acero", varillas: "acero", ladrillos: "ladrillo", membranas: "membrana", cables: "cable", canos: "cano", plasticor: "cal", hormigon: "hormigon" };

function mejorInsumo(material: string, insumos: Insumo[]): Insumo | undefined {
  const ws = normalizar(material).split(" ").filter((w) => w.length > 2 && !["de", "del", "para", "los", "las", "una", "unos"].includes(w) && !UNIDADES[w]).map((w) => SIN_MAT[w] ?? w);
  const nums = (normalizar(material).match(/\d+/g) ?? []);
  let best: { i: Insumo; s: number } | undefined;
  for (const i of insumos.filter((x) => x.tipo !== "mano_obra")) {
    const palabras = normalizar(i.nombre).split(/[^a-z0-9]+/);
    let s = 0;
    for (const w of ws) {
      const raiz = w.length > 5 ? w.slice(0, -1) : w;
      if (palabras.includes(w) || palabras.includes(w.replace(/s$/, ""))) s += w.length * 2; // palabra exacta (o singular)
      else if (palabras.some((p) => p.startsWith(raiz))) s += w.length; // misma raíz
    }
    if (palabras[0] && ws.some((w) => palabras[0].startsWith(w.slice(0, 5)))) s += 2; // el material es el sustantivo principal
    if (s > 0 && nums.some((n) => palabras.some((p) => p === n || p.startsWith(n + "x") || p.endsWith("x" + n)))) s += 3; // medida: "de 12"
    if (s >= 4 && (!best || s > best.s)) best = { i, s };
  }
  return best?.i;
}

export const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function extraerPorcentaje(texto: string): number | null {
  const m = normalizar(texto).match(/(\d{1,3})\s*(%|por ?ciento)/) ?? normalizar(texto).match(/^(\d{1,3})$/);
  if (!m) return null;
  const v = Number(m[1]);
  return v >= 0 && v <= 100 ? v : null;
}

export function extraerNumeroLista(texto: string): number | null {
  const m = normalizar(texto).match(/^(?:la |el |opcion |obra )?(\d{1,2})$/);
  return m ? Number(m[1]) : null;
}
