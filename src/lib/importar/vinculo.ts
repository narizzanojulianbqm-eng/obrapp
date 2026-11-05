/**
 * Reconoce a qué tarea de las plantillas de Obrapp corresponde cada ítem importado,
 * para sumarle materiales, mano de obra y rendimiento (y así calcular cómputo, costo y duración).
 */
import { normalizar } from "../asistente/texto";
import { plantillaPara, SISTEMAS, TIPOS_OBRA, type PlantillaItem } from "../engine/plantillas";

const STOP = new Set(["de", "del", "la", "las", "el", "los", "en", "y", "e", "con", "para", "por", "a", "al", "x", "cm", "mm", "tipo", "provision", "colocacion", "ejecucion", "nuevo", "nuevos", "nueva", "nuevas", "completo", "completa", "segun", "plano", "incluye", "manos", "mano", "obra"]);
const SINONIMOS: Record<string, string> = {
  mamposteria: "muro", mamp: "muro", pared: "muro", paredes: "muro", muros: "muro", ladrillos: "ladrillo", tabique: "tabiques",
  revoques: "revoque", enlucido: "fino", jaharro: "grueso", azotado: "hidrofugo", hidrofugo: "hidrofugo",
  contrapisos: "contrapiso", carpetas: "carpeta", cielorrasos: "cielorraso", cielo: "cielorraso", cielos: "cielorraso", durlock: "placa", yeso: "placa",
  pintura: "latex", pinturas: "latex", latex: "latex", ceramica: "ceramico", ceramicos: "ceramico", azulejos: "ceramico", revestimientos: "revestimiento",
  porcellanato: "porcelanato", pisos: "piso", solado: "piso", solados: "piso", zocalo: "zocalos",
  excavacion: "excavacion", excavaciones: "excavacion", zanjas: "excavacion", movimiento: "excavacion", terraplen: "relleno", rellenos: "relleno", tosca: "relleno",
  hormigon: "hormigon", ha: "hormigon", hºaº: "hormigon", hoao: "hormigon", "h°a°": "hormigon", fundaciones: "fundacion", cimientos: "fundacion", cimiento: "fundacion", zapatas: "fundacion", vigas: "viga", columnas: "columna", encadenados: "columna", encadenado: "columna",
  losa: "losas", viguetas: "losas", techo: "cubierta", techos: "cubierta", membrana: "membrana", impermeabilizacion: "membrana", aislacion: "aislacion",
  electrica: "electrica", electricidad: "electrica", electricas: "electrica", sanitaria: "sanitaria", sanitarias: "sanitaria", agua: "sanitaria", desagues: "sanitaria", cloacales: "sanitaria", gas: "gas",
  aberturas: "ventanas", ventana: "ventanas", carpinteria: "ventanas", puerta: "puertas", griferia: "artefactos", sanitarios: "artefactos", mesada: "mesadas",
  demoliciones: "demolicion", demoler: "demolicion", escombros: "escombro", volquete: "escombro", volquetes: "escombro",
  obrador: "obrador", cerco: "obrador", vallado: "obrador", limpieza: "limpieza", replanteo: "replanteo",
};
const tokens = (s: string) => normalizar(s).replace(/[^a-z0-9ñ ]/g, " ").split(/\s+/).filter((t) => t.length > 1 && !STOP.has(t) && !/^\d+$/.test(t)).map((t) => SINONIMOS[t] ?? t);

type Variante = { key: string; nombre: string; unidad: string; item: PlantillaItem; toks: Set<string> };
let CACHE: Variante[] | null = null;
function variantes(): Variante[] {
  if (CACHE) return CACHE;
  const out: Variante[] = [];
  const vistos = new Set<string>();
  for (const t of Object.keys(TIPOS_OBRA)) for (const s of Object.keys(SISTEMAS)) for (const r of plantillaPara(t, s)) for (const i of r.items) {
    if (i.hito || vistos.has(i.key + i.nombre)) continue;
    vistos.add(i.key + i.nombre);
    out.push({ key: i.key, nombre: i.nombre, unidad: i.unidad, item: i, toks: new Set([...tokens(i.nombre), ...tokens(r.nombre)]) });
  }
  return (CACHE = out);
}

const UNI_EQ: Record<string, string[]> = { u: ["u", "baño", "local", "boca"], gl: ["gl", "u"], ml: ["ml"], m2: ["m2"], m3: ["m3"], boca: ["boca", "u"], local: ["local", "u"], "baño": ["baño", "u"] };

/** Devuelve la tarea de plantilla más parecida (o null si ninguna se parece lo suficiente). */
export function vincularPlantilla(nombre: string, unidad: string, rubro = ""): { key: string; nombre: string; item: PlantillaItem; puntaje: number } | null {
  const tk = new Set([...tokens(nombre), ...tokens(rubro).slice(0, 2)]);
  const propios = new Set(tokens(nombre));
  if (!propios.size) return null;
  let mejor: { v: Variante; p: number } | null = null;
  for (const v of variantes()) {
    const compatibles = UNI_EQ[unidad] ?? [unidad];
    if (unidad && unidad !== "gl" && !compatibles.includes(v.unidad)) continue;
    let comunes = 0;
    for (const t of propios) if (v.toks.has(t)) comunes++;
    if (!comunes) continue;
    let extra = 0;
    for (const t of tk) if (!propios.has(t) && v.toks.has(t)) extra++;
    const p = comunes / Math.min(propios.size, 4) + 0.15 * extra + (v.unidad === unidad ? 0.1 : 0);
    if (!mejor || p > mejor.p) mejor = { v, p };
  }
  if (!mejor || mejor.p < 0.6) return null;
  return { key: mejor.v.key, nombre: mejor.v.nombre, item: mejor.v.item, puntaje: Math.round(mejor.p * 100) / 100 };
}
