export const PLANES = {
  gratuito: { nombre: "Gratuito", obrasActivas: 1, consultasIA: 20, miembrosPorObra: 4, descripcion: "Para probar la plataforma con una obra." },
  profesional: { nombre: "Profesional", obrasActivas: 10, consultasIA: 300, miembrosPorObra: 20, descripcion: "Para arquitectos independientes." },
  estudio: { nombre: "Estudio / Constructora", obrasActivas: 60, consultasIA: 1500, miembrosPorObra: 100, descripcion: "Para estudios y empresas con varios equipos." },
} as const;

export type PlanKey = keyof typeof PLANES;
