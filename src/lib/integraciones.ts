/**
 * Capa de integraciones externas (proveedores, email, WhatsApp Business, pagos).
 *
 * Hoy: genera el texto del pedido y links listos (mailto: / wa.me) para que el arquitecto los envíe con un clic.
 * Mañana: implementar `CanalEnvio` para cada canal (SMTP/Resend, API oficial de WhatsApp Business,
 * API o catálogo del proveedor) sin tocar el resto de la aplicación.
 * Ningún envío ni pago se dispara sin la confirmación explícita del responsable de la obra.
 */
import type { Obra } from "./db/schema";

export interface CanalEnvio {
  nombre: "email" | "whatsapp" | "api" | "catalogo";
  enviar(destino: string, asunto: string, cuerpo: string): Promise<{ ok: boolean; idExterno?: string }>;
}

type Prov = { nombre: string; email: string | null; whatsapp: string | null; telefono: string | null };
type Linea = { descripcion: string; cantidad: number; unidad: string };

export function mensajeCotizacion({ obra, proveedor, lineas, firmante, link }: { obra: Obra; proveedor: Prov; lineas: Linea[]; firmante: string; link?: string }) {
  const asunto = `Pedido de cotización – ${obra.nombre}`;
  const cuerpo = [
    `Hola ${proveedor.nombre}, ¿cómo están?`,
    ``,
    `Les pido cotización de los siguientes materiales para la obra "${obra.nombre}"${obra.localidad ? ` (${obra.localidad})` : ""}:`,
    ``,
    ...lineas.map((l, i) => `${i + 1}. ${l.descripcion}: ${fmt(l.cantidad)} ${l.unidad}`),
    ``,
    `Por favor indiquen precio unitario, disponibilidad, costo y plazo de envío${obra.direccion ? ` a ${obra.direccion}` : ""}, y condiciones de pago.`,
    ...(link ? [``, `Pueden cargar la cotización directamente en este link (no hace falta registrarse): ${link}`] : []),
    ``,
    `Gracias,`,
    firmante,
  ].join("\n");
  const wa = (proveedor.whatsapp || proveedor.telefono || "").replace(/\D/g, "");
  return {
    asunto,
    cuerpo,
    mailto: proveedor.email ? `mailto:${proveedor.email}?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(cuerpo)}` : null,
    whatsapp: wa ? `https://wa.me/${wa.startsWith("54") ? wa : "549" + wa}?text=${encodeURIComponent(cuerpo)}` : null,
  };
}

const fmt = (n: number) => n.toLocaleString("es-AR", { maximumFractionDigits: 2 });
