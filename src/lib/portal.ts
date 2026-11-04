import type { schema } from "./db";

export const SECCIONES_PORTAL = [
  { clave: "cronograma", label: "Cronograma", rutas: ["gantt"] },
  { clave: "avances", label: "Avances y fotos", rutas: ["seguimiento", "partes"] },
  { clave: "presupuesto", label: "Presupuesto y adicionales", rutas: ["presupuesto"] },
  { clave: "compras", label: "Compras y gastos", rutas: ["compras"] },
  { clave: "documentos", label: "Documentación", rutas: ["documentos"] },
  { clave: "mensajes", label: "Mensajes", rutas: ["mensajes"] },
  { clave: "asistente", label: "Asistente", rutas: ["asistente"] },
] as const;
export type ClavePortal = (typeof SECCIONES_PORTAL)[number]["clave"];

/** Todo visible por defecto: el arquitecto oculta lo que no quiere mostrar. */
export function clienteVe(obra: Pick<typeof schema.obras.$inferSelect, "portalCliente">, clave: ClavePortal) {
  return obra.portalCliente?.[clave] !== false;
}

/** Sección del portal a la que pertenece una ruta /obras/<id>/<segmento>, o null. */
export function seccionDeRuta(pathname: string): ClavePortal | null {
  const seg = pathname.split("/")[3];
  if (!seg) return null;
  return SECCIONES_PORTAL.find((s) => (s.rutas as readonly string[]).includes(seg))?.clave ?? null;
}
