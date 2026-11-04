import type { Rol } from "./db/schema";

export const CANALES = {
  general: { nombre: "General", descripcion: "Todo el equipo de la obra", roles: ["arquitecto", "cliente", "obrero"] as Rol[] },
  cliente: { nombre: "Arquitecto ↔ Cliente", descripcion: "Decisiones, cambios y aprobaciones", roles: ["arquitecto", "cliente"] as Rol[] },
  obra: { nombre: "Arquitecto ↔ Obra", descripcion: "Coordinación con obreros y encargados", roles: ["arquitecto", "obrero"] as Rol[] },
} as const;

export function rolesDeCanal(canal: string): Rol[] {
  if (canal in CANALES) return CANALES[canal as keyof typeof CANALES].roles;
  if (canal.startsWith("item:")) return ["arquitecto", "obrero"];
  return [];
}
export const puedeCanal = (rol: Rol, canal: string) => rolesDeCanal(canal).includes(rol);
