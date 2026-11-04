/**
 * Plantillas de producción de obra (metodología habitual en Argentina).
 *
 * IMPORTANTE: los consumos y rendimientos son valores técnicos de referencia para arrancar el cómputo.
 * Todos son editables por obra. La plataforma NO trae precios: los carga el arquitecto (o salen de cotizaciones).
 */

export const TIPOS_OBRA = {
  vivienda_unifamiliar: "Vivienda unifamiliar",
  vivienda_multifamiliar: "Vivienda multifamiliar / edificio",
  local_comercial: "Local comercial",
  oficinas: "Oficinas",
  ampliacion: "Ampliación",
  refaccion: "Refacción / remodelación",
} as const;

export const SISTEMAS = {
  tradicional: "Tradicional (HºAº + mampostería cerámica)",
  steel_frame: "Steel frame (construcción en seco)",
} as const;

export type TipoObra = keyof typeof TIPOS_OBRA;
export type Sistema = keyof typeof SISTEMAS;

// ───────── Catálogo de insumos de referencia (sin precios) ─────────
export const CATALOGO_INSUMOS: Record<string, { tipo: "material" | "mano_obra" | "equipo"; nombre: string; unidad: string }> = {
  oficial: { tipo: "mano_obra", nombre: "Oficial albañil", unidad: "h" },
  ayudante: { tipo: "mano_obra", nombre: "Ayudante", unidad: "h" },
  oficial_esp: { tipo: "mano_obra", nombre: "Oficial especializado (instalador / colocador)", unidad: "h" },
  pintor: { tipo: "mano_obra", nombre: "Oficial pintor", unidad: "h" },
  durlockero: { tipo: "mano_obra", nombre: "Oficial montador en seco", unidad: "h" },

  hormigonera: { tipo: "equipo", nombre: "Hormigonera 150 l", unidad: "h" },
  andamio: { tipo: "equipo", nombre: "Andamio tubular (alquiler)", unidad: "m2·mes" },
  volquete: { tipo: "equipo", nombre: "Volquete", unidad: "u" },

  cemento: { tipo: "material", nombre: "Cemento portland (bolsa 50 kg)", unidad: "bolsa" },
  cal: { tipo: "material", nombre: "Cal hidratada (bolsa 25 kg)", unidad: "bolsa" },
  arena: { tipo: "material", nombre: "Arena gruesa", unidad: "m3" },
  piedra: { tipo: "material", nombre: "Piedra partida 6-20", unidad: "m3" },
  cascote: { tipo: "material", nombre: "Cascote / ripio", unidad: "m3" },
  tosca: { tipo: "material", nombre: "Tosca para relleno", unidad: "m3" },
  hidrofugo: { tipo: "material", nombre: "Hidrófugo inorgánico", unidad: "kg" },
  h21: { tipo: "material", nombre: "Hormigón elaborado H-21", unidad: "m3" },
  hierro: { tipo: "material", nombre: "Acero ADN 420 (barras)", unidad: "kg" },
  alambre: { tipo: "material", nombre: "Alambre de atar", unidad: "kg" },
  clavos: { tipo: "material", nombre: "Clavos", unidad: "kg" },
  encofrado: { tipo: "material", nombre: "Encofrado fenólico (amortizado)", unidad: "m2" },
  malla: { tipo: "material", nombre: "Malla sima 15x15 Ø4,2", unidad: "m2" },
  vigueta: { tipo: "material", nombre: "Vigueta pretensada", unidad: "ml" },
  bloque_losa: { tipo: "material", nombre: "Bloque cerámico para losa", unidad: "u" },
  ladrillo_hueco18: { tipo: "material", nombre: "Ladrillo cerámico hueco portante 18x19x33", unidad: "u" },
  ladrillo_hueco12: { tipo: "material", nombre: "Ladrillo cerámico hueco 12x18x33", unidad: "u" },
  film: { tipo: "material", nombre: "Film polietileno 200 µ", unidad: "m2" },
  membrana: { tipo: "material", nombre: "Membrana asfáltica con aluminio 4 mm", unidad: "m2" },
  eps: { tipo: "material", nombre: "Poliestireno expandido (aislación)", unidad: "m2" },
  imprimacion: { tipo: "material", nombre: "Imprimación asfáltica", unidad: "l" },
  yeso: { tipo: "material", nombre: "Yeso (bolsa 40 kg)", unidad: "bolsa" },
  ceramico: { tipo: "material", nombre: "Revestimiento cerámico", unidad: "m2" },
  porcelanato: { tipo: "material", nombre: "Porcelanato", unidad: "m2" },
  piso_ext: { tipo: "material", nombre: "Piso exterior antideslizante", unidad: "m2" },
  adhesivo: { tipo: "material", nombre: "Adhesivo cementicio (bolsa 30 kg)", unidad: "bolsa" },
  pastina: { tipo: "material", nombre: "Pastina", unidad: "kg" },
  zocalo: { tipo: "material", nombre: "Zócalo", unidad: "ml" },
  cable: { tipo: "material", nombre: "Cable unipolar 2,5 mm²", unidad: "m" },
  corrugado: { tipo: "material", nombre: "Caño corrugado 3/4\"", unidad: "m" },
  caja_luz: { tipo: "material", nombre: "Caja de luz / derivación", unidad: "u" },
  tablero: { tipo: "material", nombre: "Tablero seccional con protecciones", unidad: "u" },
  sanit_agua: { tipo: "material", nombre: "Cañerías y accesorios agua fría/caliente (por local)", unidad: "gl" },
  sanit_desague: { tipo: "material", nombre: "Cañerías y accesorios de desagüe (por local)", unidad: "gl" },
  gas_boca: { tipo: "material", nombre: "Cañería epoxi y accesorios de gas (por boca)", unidad: "gl" },
  artefactos_bano: { tipo: "material", nombre: "Artefactos sanitarios y grifería (por baño)", unidad: "gl" },
  mesada: { tipo: "material", nombre: "Mesada con bacha y grifería", unidad: "u" },
  llaves: { tipo: "material", nombre: "Llaves, tomas y artefactos de iluminación (promedio por boca)", unidad: "u" },
  puerta_placa: { tipo: "material", nombre: "Puerta placa con marco", unidad: "u" },
  puerta_acceso: { tipo: "material", nombre: "Puerta de acceso", unidad: "u" },
  ventana: { tipo: "material", nombre: "Ventana de aluminio con vidrio (≈1,20x1,10)", unidad: "u" },
  latex_int: { tipo: "material", nombre: "Látex interior", unidad: "l" },
  latex_ext: { tipo: "material", nombre: "Látex exterior", unidad: "l" },
  fijador: { tipo: "material", nombre: "Fijador sellador", unidad: "l" },
  enduido: { tipo: "material", nombre: "Enduido", unidad: "kg" },
  obrador: { tipo: "material", nombre: "Obrador, cerco y conexiones provisorias", unidad: "gl" },
  perfil_steel: { tipo: "material", nombre: "Perfiles PGC/PGU galvanizados", unidad: "ml" },
  tornillos: { tipo: "material", nombre: "Tornillos autoperforantes", unidad: "u" },
  osb: { tipo: "material", nombre: "Placa OSB 11 mm", unidad: "m2" },
  barrera: { tipo: "material", nombre: "Barrera de agua y viento", unidad: "m2" },
  basecoat: { tipo: "material", nombre: "Base coat + malla (EIFS)", unidad: "kg" },
  placa_yeso: { tipo: "material", nombre: "Placa de yeso 12,5 mm", unidad: "m2" },
  masilla: { tipo: "material", nombre: "Masilla para juntas", unidad: "kg" },
  cinta: { tipo: "material", nombre: "Cinta de papel para juntas", unidad: "ml" },
  lana_vidrio: { tipo: "material", nombre: "Lana de vidrio 50 mm", unidad: "m2" },
  escombro: { tipo: "material", nombre: "Retiro de escombros (volquete)", unidad: "u" },
};

// ───────── Parámetros geométricos ─────────
export type ObraBase = { tipo: string; sistema: string; supCubierta: number; supSemicubierta: number; niveles: number };

export const PARAMETROS_INFO: Record<string, { label: string; unidad: string; ayuda: string }> = {
  perimetro: { label: "Perímetro exterior por planta", unidad: "ml", ayuda: "Longitud de muros exteriores de una planta tipo" },
  altura: { label: "Altura de piso a piso", unidad: "m", ayuda: "" },
  murosInteriores: { label: "Longitud total de muros/tabiques interiores", unidad: "ml", ayuda: "Suma de todas las plantas" },
  aberturasPct: { label: "Porcentaje de aberturas en fachada", unidad: "%", ayuda: "Se descuenta de la mampostería exterior" },
  banos: { label: "Cantidad de baños", unidad: "u", ayuda: "" },
  cocinas: { label: "Cantidad de cocinas / kitchenettes", unidad: "u", ayuda: "" },
  puertas: { label: "Puertas interiores", unidad: "u", ayuda: "" },
  ventanas: { label: "Ventanas", unidad: "u", ayuda: "" },
  bocas: { label: "Bocas eléctricas", unidad: "u", ayuda: "Tomas + bocas de iluminación" },
  terreno: { label: "Superficie de terreno a limpiar", unidad: "m2", ayuda: "" },
  alcance: { label: "Alcance de intervención (refacciones)", unidad: "%", ayuda: "Porcentaje de la superficie que se interviene" },
};

export function parametrosPorDefecto(o: ObraBase): Record<string, number> {
  const S = Math.max(o.supCubierta, 1);
  const N = Math.max(o.niveles, 1);
  const planta = S / N;
  const multi = o.tipo === "vivienda_multifamiliar" || o.tipo === "oficinas";
  return {
    perimetro: r1(4 * Math.sqrt(planta) * 1.15),
    altura: 2.8,
    murosInteriores: r1(S * (o.tipo === "local_comercial" ? 0.15 : 0.45)),
    aberturasPct: 15,
    banos: Math.max(1, Math.round(S / (multi ? 45 : 60))),
    cocinas: multi ? Math.max(1, Math.round(S / 70)) : 1,
    puertas: Math.max(2, Math.round(S / 14)),
    ventanas: Math.max(2, Math.round(S / 12)),
    bocas: Math.round(S * 0.6),
    terreno: r1(planta * 1.6),
    alcance: o.tipo === "refaccion" ? 40 : 100,
  };
}

const r1 = (n: number) => Math.round(n * 10) / 10;
const r2 = (n: number) => Math.round(n * 100) / 100;

/** Magnitudes derivadas que usan las fórmulas. */
export function magnitudes(o: ObraBase, p: Record<string, number>) {
  const S = o.supCubierta;
  const SS = o.supSemicubierta;
  const N = Math.max(o.niveles, 1);
  const planta = S / N;
  const ab = (p.aberturasPct ?? 15) / 100;
  const alc = (p.alcance ?? 100) / 100;
  const muroExt = p.perimetro * p.altura * N * (1 - ab);
  const muroInt = p.murosInteriores * p.altura * 0.92;
  const cimientos = p.perimetro + p.murosInteriores / N;
  const g = (k: string, d = 0) => p[k] ?? d;
  return {
    S, SS, N, planta, muroExt, muroInt, cimientos, alc,
    perimetro: g("perimetro"), altura: g("altura", 2.8), murosInteriores: g("murosInteriores"), banos: g("banos", 1), cocinas: g("cocinas", 1),
    puertas: g("puertas"), ventanas: g("ventanas"), bocas: g("bocas"), terreno: g("terreno"),
  };
}
export type Mag = ReturnType<typeof magnitudes>;

// ───────── Definición de plantillas ─────────
type Dep = string | { key: string; tipo?: "FC" | "CC"; desfase?: number };
export type PlantillaItem = {
  key: string;
  nombre: string;
  unidad: string;
  formula: string; // clave en FORMULAS
  recursos: Record<string, number>; // clave insumo → consumo por unidad (MO en horas)
  deps?: Dep[];
  hito?: boolean;
  /** duración fija (días) en lugar de calcularla por rendimiento */
  duracionFija?: number;
};
export type PlantillaRubro = { nombre: string; items: PlantillaItem[] };

export const FORMULAS: Record<string, { label: string; fn: (m: Mag) => number }> = {
  uno: { label: "1 (global)", fn: () => 1 },
  cero: { label: "Hito", fn: () => 0 },
  terreno: { label: "Sup. de terreno", fn: (m) => m.terreno },
  planta: { label: "Sup. cubierta / niveles", fn: (m) => m.planta },
  sup_cubierta: { label: "Sup. cubierta", fn: (m) => m.S },
  sup_total: { label: "Sup. cubierta + semicubierta", fn: (m) => m.S + m.SS },
  sup_semi: { label: "Sup. semicubierta", fn: (m) => m.SS },
  contrapiso: { label: "Planta baja + semicubierta", fn: (m) => m.planta + m.SS },
  losas: { label: "Sup. de losas (entrepisos + cubierta)", fn: (m) => m.planta * m.N },
  cubierta: { label: "Sup. de cubierta (+5% babetas)", fn: (m) => m.planta * 1.05 + m.SS },
  excavacion: { label: "ml cimientos × 0,45 × 0,80", fn: (m) => m.cimientos * 0.45 * 0.8 },
  excav_platea: { label: "Sup. planta × 0,30", fn: (m) => m.planta * 0.3 },
  relleno: { label: "Sup. planta × 0,15", fn: (m) => m.planta * 0.15 },
  cimientos_m3: { label: "ml cimientos × 0,30 × 0,40", fn: (m) => m.cimientos * 0.3 * 0.4 },
  cimientos_ml: { label: "ml de cimientos", fn: (m) => m.cimientos },
  hormigon_elev: { label: "Sup. cubierta × 0,04 m3/m2", fn: (m) => m.S * 0.04 },
  muro_ext: { label: "Perímetro × altura × niveles − aberturas", fn: (m) => m.muroExt },
  muro_int: { label: "ml muros interiores × altura", fn: (m) => m.muroInt },
  muros_todos: { label: "Muros exteriores + interiores", fn: (m) => m.muroExt + m.muroInt },
  revoque_int: { label: "Muros int. (2 caras) + cara int. de exteriores", fn: (m) => m.muroInt * 2 + m.muroExt },
  pintura_int: { label: "Revoque interior + cielorrasos", fn: (m) => m.muroInt * 2 + m.muroExt + m.S },
  aislacion_sf: { label: "Muros ext. + cubierta", fn: (m) => m.muroExt + m.planta },
  humedos: { label: "Baños × 14 m² + cocinas × 6 m²", fn: (m) => m.banos * 14 + m.cocinas * 6 },
  zocalos: { label: "Muros int. × 2 + perímetro × niveles", fn: (m) => m.murosInteriores * 2 + m.perimetro * m.N },
  locales_humedos: { label: "Baños + cocinas", fn: (m) => m.banos + m.cocinas },
  bocas_gas: { label: "Cocinas + 1 (calentador)", fn: (m) => m.cocinas + 1 },
  banos: { label: "Baños", fn: (m) => m.banos },
  cocinas: { label: "Cocinas", fn: (m) => m.cocinas },
  puertas: { label: "Puertas", fn: (m) => m.puertas },
  ventanas: { label: "Ventanas", fn: (m) => m.ventanas },
  bocas: { label: "Bocas eléctricas", fn: (m) => m.bocas },
  tableros: { label: "1 por nivel", fn: (m) => m.N },
  // Refacciones: afectadas por el alcance
  ref_superficie: { label: "Sup. cubierta × alcance", fn: (m) => m.S * m.alc },
  ref_muro_int: { label: "Muros int. × alcance", fn: (m) => m.muroInt * m.alc },
  ref_revoque: { label: "Revoque int. × alcance", fn: (m) => (m.muroInt * 2 + m.muroExt) * m.alc },
  ref_pintura: { label: "Pintura int. total", fn: (m) => m.muroInt * 2 + m.muroExt + m.S },
  ref_demolicion: { label: "Sup. × alcance × 0,10 m3/m2", fn: (m) => m.S * m.alc * 0.1 },
  ref_volquetes: { label: "1 volquete cada 5 m3 de demolición", fn: (m) => Math.max(1, Math.ceil((m.S * m.alc * 0.1) / 5)) },
  ref_bocas: { label: "Bocas × alcance", fn: (m) => Math.round(m.bocas * m.alc) },
};

export function evaluarFormula(formula: string | null, m: Mag): number {
  if (!formula || !FORMULAS[formula]) return 0;
  return r2(Math.max(0, FORMULAS[formula].fn(m)));
}

// Rubros comunes a ambos sistemas (de instalaciones en adelante)
const instalaciones = (depBase: string): PlantillaRubro => ({
  nombre: "Instalaciones",
  items: [
    { key: "electrica", nombre: "Instalación eléctrica (cañerías, cableado y cajas)", unidad: "boca", formula: "bocas", recursos: { cable: 12, corrugado: 4, caja_luz: 1, oficial_esp: 1.5, ayudante: 0.8 }, deps: [{ key: depBase, tipo: "CC", desfase: 5 }] },
    { key: "tablero", nombre: "Tablero seccional y puesta a tierra", unidad: "u", formula: "tableros", recursos: { tablero: 1, oficial_esp: 8 }, deps: ["electrica"] },
    { key: "sanitaria", nombre: "Instalación sanitaria (agua y desagües)", unidad: "local", formula: "locales_humedos", recursos: { sanit_agua: 1, sanit_desague: 1, oficial_esp: 24, ayudante: 16 }, deps: [{ key: depBase, tipo: "CC", desfase: 5 }] },
    { key: "gas", nombre: "Instalación de gas", unidad: "boca", formula: "bocas_gas", recursos: { gas_boca: 1, oficial_esp: 8, ayudante: 4 }, deps: [{ key: "sanitaria", tipo: "CC", desfase: 2 }] },
  ],
});

const terminaciones = (depRev: string, depCielo: string): PlantillaRubro[] => [
  {
    nombre: "Revestimientos",
    items: [{ key: "revestimiento", nombre: "Revestimiento cerámico en baños y cocina", unidad: "m2", formula: "humedos", recursos: { ceramico: 1.08, adhesivo: 0.18, pastina: 0.3, oficial_esp: 0.8, ayudante: 0.4 }, deps: [depRev] }],
  },
  {
    nombre: "Pisos y zócalos",
    items: [
      { key: "piso", nombre: "Piso de porcelanato", unidad: "m2", formula: "sup_cubierta", recursos: { porcelanato: 1.08, adhesivo: 0.2, pastina: 0.25, oficial_esp: 0.6, ayudante: 0.3 }, deps: ["carpeta"] },
      { key: "piso_ext", nombre: "Piso exterior en semicubiertos", unidad: "m2", formula: "sup_semi", recursos: { piso_ext: 1.08, adhesivo: 0.2, pastina: 0.25, oficial_esp: 0.6, ayudante: 0.3 }, deps: [{ key: "piso", tipo: "CC", desfase: 3 }] },
      { key: "zocalos", nombre: "Zócalos", unidad: "ml", formula: "zocalos", recursos: { zocalo: 1.05, adhesivo: 0.02, oficial_esp: 0.15 }, deps: ["piso"] },
    ],
  },
  {
    nombre: "Carpinterías",
    items: [
      { key: "ventanas", nombre: "Ventanas de aluminio (provisión y colocación)", unidad: "u", formula: "ventanas", recursos: { ventana: 1, oficial: 3, ayudante: 2 }, deps: [depCielo] },
      { key: "puerta_acceso", nombre: "Puerta de acceso", unidad: "u", formula: "uno", recursos: { puerta_acceso: 1, oficial: 4, ayudante: 2 }, deps: [{ key: "ventanas", tipo: "CC", desfase: 0 }] },
      { key: "puertas", nombre: "Puertas placa interiores", unidad: "u", formula: "puertas", recursos: { puerta_placa: 1, oficial: 3, ayudante: 2 }, deps: ["piso"] },
    ],
  },
  {
    nombre: "Pintura",
    items: [
      { key: "pintura_int", nombre: "Látex interior en muros y cielorrasos (2 manos)", unidad: "m2", formula: "pintura_int", recursos: { latex_int: 0.3, fijador: 0.1, enduido: 0.3, pintor: 0.35 }, deps: ["zocalos", depCielo] },
      { key: "pintura_ext", nombre: "Látex exterior (2 manos)", unidad: "m2", formula: "muro_ext", recursos: { latex_ext: 0.35, fijador: 0.1, pintor: 0.35 }, deps: ["ventanas"] },
    ],
  },
  {
    nombre: "Artefactos y terminaciones",
    items: [
      { key: "artefactos_bano", nombre: "Artefactos sanitarios y grifería", unidad: "baño", formula: "banos", recursos: { artefactos_bano: 1, oficial_esp: 8 }, deps: [{ key: "pintura_int", tipo: "CC", desfase: 3 }, "revestimiento"] },
      { key: "mesadas", nombre: "Mesadas de cocina", unidad: "u", formula: "cocinas", recursos: { mesada: 1, oficial_esp: 6 }, deps: ["revestimiento"] },
      { key: "llaves", nombre: "Llaves, tomas y artefactos de iluminación", unidad: "boca", formula: "bocas", recursos: { llaves: 1, oficial_esp: 0.3 }, deps: [{ key: "pintura_int", tipo: "CC", desfase: 5 }] },
    ],
  },
  {
    nombre: "Limpieza final",
    items: [
      { key: "limpieza", nombre: "Limpieza final de obra", unidad: "m2", formula: "sup_total", recursos: { ayudante: 0.15 }, deps: ["pintura_int", "pintura_ext", "artefactos_bano", "llaves", "puertas"] },
      { key: "fin", nombre: "Fin de obra / entrega", unidad: "hito", formula: "cero", recursos: {}, deps: ["limpieza"], hito: true },
    ],
  },
];

const preliminares: PlantillaRubro = {
  nombre: "Trabajos preliminares",
  items: [
    { key: "inicio", nombre: "Inicio de obra", unidad: "hito", formula: "cero", recursos: {}, hito: true },
    { key: "obrador", nombre: "Obrador, cerco y conexiones provisorias", unidad: "gl", formula: "uno", recursos: { obrador: 1, oficial: 16, ayudante: 16 }, deps: ["inicio"] },
    { key: "limpieza_terreno", nombre: "Limpieza y nivelación del terreno", unidad: "m2", formula: "terreno", recursos: { ayudante: 0.15 }, deps: [{ key: "obrador", tipo: "CC" }] },
    { key: "replanteo", nombre: "Replanteo", unidad: "m2", formula: "planta", recursos: { oficial: 0.05, ayudante: 0.05 }, deps: ["limpieza_terreno"] },
  ],
};

const TRADICIONAL: PlantillaRubro[] = [
  preliminares,
  {
    nombre: "Movimiento de suelo",
    items: [
      { key: "excavacion", nombre: "Excavación de zanjas y bases", unidad: "m3", formula: "excavacion", recursos: { ayudante: 3 }, deps: ["replanteo"] },
      { key: "relleno", nombre: "Relleno y compactación con tosca", unidad: "m3", formula: "relleno", recursos: { tosca: 1.25, ayudante: 1.5 }, deps: ["cimientos"] },
    ],
  },
  {
    nombre: "Estructuras",
    items: [
      { key: "cimientos", nombre: "Vigas de fundación de HºAº", unidad: "m3", formula: "cimientos_m3", recursos: { h21: 1.05, hierro: 70, alambre: 1, encofrado: 2, oficial: 5, ayudante: 7 }, deps: ["excavacion"] },
      { key: "columnas", nombre: "Columnas, vigas y encadenados de HºAº", unidad: "m3", formula: "hormigon_elev", recursos: { h21: 1.05, hierro: 110, alambre: 1.5, clavos: 1, encofrado: 6, oficial: 14, ayudante: 14 }, deps: [{ key: "muro_ext", tipo: "CC", desfase: 3 }] },
      { key: "losas", nombre: "Losas de viguetas pretensadas", unidad: "m2", formula: "losas", recursos: { vigueta: 2, bloque_losa: 8, h21: 0.06, malla: 1.1, oficial: 1.2, ayudante: 1.5 }, deps: ["columnas"] },
      { key: "hito_estructura", nombre: "Estructura terminada", unidad: "hito", formula: "cero", recursos: {}, deps: ["losas"], hito: true },
    ],
  },
  {
    nombre: "Albañilería",
    items: [
      { key: "capa_aisladora", nombre: "Capa aisladora horizontal", unidad: "ml", formula: "cimientos_ml", recursos: { cemento: 0.13, arena: 0.015, hidrofugo: 0.4, oficial: 0.4, ayudante: 0.4 }, deps: ["cimientos"] },
      { key: "muro_ext", nombre: "Mampostería exterior de ladrillo hueco portante 18 cm", unidad: "m2", formula: "muro_ext", recursos: { ladrillo_hueco18: 15.5, cemento: 0.08, cal: 0.15, arena: 0.025, oficial: 0.8, ayudante: 0.8 }, deps: ["capa_aisladora"] },
      { key: "muro_int", nombre: "Tabiques de ladrillo hueco 12 cm", unidad: "m2", formula: "muro_int", recursos: { ladrillo_hueco12: 15.5, cemento: 0.05, cal: 0.1, arena: 0.018, oficial: 0.6, ayudante: 0.6 }, deps: [{ key: "muro_ext", tipo: "CC", desfase: 5 }] },
    ],
  },
  {
    nombre: "Cubiertas",
    items: [{ key: "cubierta", nombre: "Aislación térmica y membrana de cubierta", unidad: "m2", formula: "cubierta", recursos: { eps: 1.05, membrana: 1.15, imprimacion: 0.3, oficial: 0.35, ayudante: 0.35 }, deps: ["losas"] }],
  },
  instalaciones("muro_int"),
  {
    nombre: "Revoques",
    items: [
      { key: "revoque_int", nombre: "Revoque grueso y fino interior", unidad: "m2", formula: "revoque_int", recursos: { cemento: 0.06, cal: 0.25, arena: 0.03, oficial: 0.7, ayudante: 0.5, andamio: 0.05 }, deps: ["electrica", "sanitaria", "losas"] },
      { key: "revoque_ext", nombre: "Revoque exterior completo (azotado hidrófugo, grueso y fino)", unidad: "m2", formula: "muro_ext", recursos: { cemento: 0.12, cal: 0.25, arena: 0.035, hidrofugo: 0.5, oficial: 0.9, ayudante: 0.7, andamio: 0.15 }, deps: ["cubierta"] },
    ],
  },
  {
    nombre: "Contrapisos y carpetas",
    items: [
      { key: "contrapiso", nombre: "Contrapiso de hormigón pobre 12 cm", unidad: "m2", formula: "contrapiso", recursos: { cemento: 0.25, arena: 0.06, cascote: 0.09, oficial: 0.4, ayudante: 0.5, hormigonera: 0.1 }, deps: ["relleno", "sanitaria"] },
      { key: "carpeta", nombre: "Carpeta de nivelación", unidad: "m2", formula: "sup_cubierta", recursos: { cemento: 0.18, arena: 0.025, oficial: 0.3, ayudante: 0.25 }, deps: ["contrapiso", "revoque_int"] },
    ],
  },
  {
    nombre: "Cielorrasos",
    items: [{ key: "cielorraso", nombre: "Cielorraso aplicado de yeso bajo losa", unidad: "m2", formula: "sup_cubierta", recursos: { yeso: 0.3, oficial: 0.45, ayudante: 0.3 }, deps: ["revoque_int"] }],
  },
  ...terminaciones("revoque_int", "cielorraso"),
];

const STEEL: PlantillaRubro[] = [
  preliminares,
  {
    nombre: "Movimiento de suelo",
    items: [
      { key: "excavacion", nombre: "Excavación y nivelación para platea", unidad: "m3", formula: "excav_platea", recursos: { ayudante: 2.5 }, deps: ["replanteo"] },
      { key: "relleno", nombre: "Relleno y compactación con tosca", unidad: "m3", formula: "relleno", recursos: { tosca: 1.25, ayudante: 1.5 }, deps: ["excavacion"] },
    ],
  },
  {
    nombre: "Fundaciones",
    items: [
      { key: "platea", nombre: "Platea de fundación de HºAº", unidad: "m2", formula: "planta", recursos: { h21: 0.16, hierro: 7, malla: 1.1, film: 1.1, oficial: 0.8, ayudante: 1 }, deps: ["relleno"] },
      { key: "hito_platea", nombre: "Platea terminada", unidad: "hito", formula: "cero", recursos: {}, deps: ["platea"], hito: true },
    ],
  },
  {
    nombre: "Estructura steel frame",
    items: [
      { key: "paneles", nombre: "Paneles de muros con perfiles galvanizados", unidad: "m2", formula: "muros_todos", recursos: { perfil_steel: 3.2, tornillos: 25, durlockero: 0.6, ayudante: 0.4 }, deps: ["platea"] },
      { key: "entrepiso", nombre: "Entrepisos y estructura de cubierta", unidad: "m2", formula: "losas", recursos: { perfil_steel: 3.5, osb: 1.1, tornillos: 30, durlockero: 0.7, ayudante: 0.5 }, deps: [{ key: "paneles", tipo: "CC", desfase: 5 }] },
      { key: "hito_estructura", nombre: "Estructura terminada", unidad: "hito", formula: "cero", recursos: {}, deps: ["entrepiso"], hito: true },
    ],
  },
  {
    nombre: "Cubiertas",
    items: [{ key: "cubierta", nombre: "Aislación y membrana de cubierta", unidad: "m2", formula: "cubierta", recursos: { eps: 1.05, membrana: 1.15, imprimacion: 0.3, oficial: 0.35, ayudante: 0.35 }, deps: ["entrepiso"] }],
  },
  {
    nombre: "Cerramientos exteriores",
    items: [
      { key: "osb_ext", nombre: "Placas OSB + barrera de agua y viento", unidad: "m2", formula: "muro_ext", recursos: { osb: 1.05, barrera: 1.1, tornillos: 20, durlockero: 0.4 }, deps: [{ key: "paneles", tipo: "CC", desfase: 3 }] },
      { key: "eifs", nombre: "Terminación exterior EIFS (EPS + base coat)", unidad: "m2", formula: "muro_ext", recursos: { eps: 1.05, basecoat: 5, durlockero: 0.6, andamio: 0.15 }, deps: ["osb_ext", "cubierta"] },
    ],
  },
  instalaciones("paneles"),
  {
    nombre: "Aislaciones y placas interiores",
    items: [
      { key: "lana", nombre: "Aislación térmica con lana de vidrio", unidad: "m2", formula: "aislacion_sf", recursos: { lana_vidrio: 1.05, durlockero: 0.1 }, deps: ["electrica", "sanitaria", "osb_ext"] },
      { key: "revoque_int", nombre: "Placas de yeso interiores, juntas y masillado", unidad: "m2", formula: "revoque_int", recursos: { placa_yeso: 1.05, tornillos: 20, masilla: 0.6, cinta: 1.5, durlockero: 0.45 }, deps: ["lana"] },
      { key: "cielorraso", nombre: "Cielorraso de placa de yeso", unidad: "m2", formula: "sup_cubierta", recursos: { placa_yeso: 1.05, perfil_steel: 2, tornillos: 15, masilla: 0.5, durlockero: 0.5 }, deps: [{ key: "revoque_int", tipo: "CC", desfase: 3 }] },
    ],
  },
  {
    nombre: "Contrapisos y carpetas",
    items: [{ key: "carpeta", nombre: "Carpeta de nivelación sobre platea", unidad: "m2", formula: "sup_cubierta", recursos: { cemento: 0.18, arena: 0.025, oficial: 0.3, ayudante: 0.25 }, deps: ["revoque_int"] }],
  },
  ...terminaciones("revoque_int", "cielorraso"),
];

const REFACCION: PlantillaRubro[] = [
  {
    nombre: "Trabajos preliminares",
    items: [
      { key: "inicio", nombre: "Inicio de obra", unidad: "hito", formula: "cero", recursos: {}, hito: true },
      { key: "protecciones", nombre: "Protecciones, vallado y obrador", unidad: "gl", formula: "uno", recursos: { obrador: 1, oficial: 8, ayudante: 8 }, deps: ["inicio"] },
    ],
  },
  {
    nombre: "Demoliciones",
    items: [
      { key: "demolicion", nombre: "Demolición de pisos, revestimientos y tabiques", unidad: "m3", formula: "ref_demolicion", recursos: { ayudante: 6, oficial: 1 }, deps: ["protecciones"] },
      { key: "volquetes", nombre: "Retiro de escombros", unidad: "u", formula: "ref_volquetes", recursos: { escombro: 1, ayudante: 2 }, deps: [{ key: "demolicion", tipo: "CC", desfase: 2 }] },
    ],
  },
  {
    nombre: "Albañilería",
    items: [{ key: "muro_int", nombre: "Tabiques nuevos de ladrillo hueco 12 cm", unidad: "m2", formula: "ref_muro_int", recursos: { ladrillo_hueco12: 15.5, cemento: 0.05, cal: 0.1, arena: 0.018, oficial: 0.6, ayudante: 0.6 }, deps: ["demolicion"] }],
  },
  {
    nombre: "Instalaciones",
    items: [
      { key: "electrica", nombre: "Readecuación de instalación eléctrica", unidad: "boca", formula: "ref_bocas", recursos: { cable: 12, corrugado: 4, caja_luz: 1, oficial_esp: 1.5, ayudante: 0.8 }, deps: [{ key: "muro_int", tipo: "CC", desfase: 2 }] },
      { key: "sanitaria", nombre: "Readecuación de instalación sanitaria", unidad: "local", formula: "locales_humedos", recursos: { sanit_agua: 1, sanit_desague: 1, oficial_esp: 24, ayudante: 16 }, deps: [{ key: "muro_int", tipo: "CC", desfase: 2 }] },
    ],
  },
  {
    nombre: "Revoques",
    items: [{ key: "revoque_int", nombre: "Revoques interiores (reparación y nuevos)", unidad: "m2", formula: "ref_revoque", recursos: { cemento: 0.06, cal: 0.25, arena: 0.03, oficial: 0.7, ayudante: 0.5 }, deps: ["electrica", "sanitaria"] }],
  },
  {
    nombre: "Contrapisos y carpetas",
    items: [{ key: "carpeta", nombre: "Carpeta de nivelación", unidad: "m2", formula: "ref_superficie", recursos: { cemento: 0.18, arena: 0.025, oficial: 0.3, ayudante: 0.25 }, deps: ["revoque_int"] }],
  },
  {
    nombre: "Cielorrasos",
    items: [{ key: "cielorraso", nombre: "Reparación de cielorrasos", unidad: "m2", formula: "ref_superficie", recursos: { yeso: 0.2, oficial: 0.35, ayudante: 0.2 }, deps: ["revoque_int"] }],
  },
  ...terminaciones("revoque_int", "cielorraso").map((r) =>
    r.nombre === "Pisos y zócalos"
      ? { ...r, items: r.items.map((i) => (i.key === "piso" ? { ...i, formula: "ref_superficie" } : i)) }
      : r.nombre === "Pintura"
        ? { ...r, items: r.items.map((i) => (i.key === "pintura_int" ? { ...i, formula: "ref_pintura" } : i)) }
        : r,
  ),
];

export function plantillaPara(tipo: string, sistema: string): PlantillaRubro[] {
  if (tipo === "refaccion") return REFACCION;
  if (sistema === "steel_frame") return STEEL;
  return TRADICIONAL;
}
