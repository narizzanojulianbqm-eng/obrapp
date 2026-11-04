/**
 * Configuración de WhatsApp Business Platform (Cloud API oficial de Meta).
 * Ver docs/whatsapp.md para el paso a paso de activación.
 */
export function waConfig() {
  return {
    token: process.env.WHATSAPP_TOKEN ?? "", // token de sistema (System User) con permiso whatsapp_business_messaging
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID ?? "",
    wabaId: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID ?? "",
    verifyToken: process.env.WHATSAPP_VERIFY_TOKEN ?? "", // lo definís vos y lo cargás en el panel de Meta
    appSecret: process.env.WHATSAPP_APP_SECRET ?? "", // para validar la firma X-Hub-Signature-256
    version: process.env.WHATSAPP_API_VERSION ?? "v23.0",
    idioma: process.env.WHATSAPP_TEMPLATE_IDIOMA ?? "es_AR",
    plantillaBienvenida: process.env.WHATSAPP_TEMPLATE_BIENVENIDA ?? "bienvenida_obra",
    plantillaAviso: process.env.WHATSAPP_TEMPLATE_AVISO ?? "aviso_obra",
    appUrl: process.env.APP_URL ?? "http://localhost:3000",
  };
}

export const waActivo = () => {
  const c = waConfig();
  return !!(c.token && c.phoneNumberId);
};

/** El simulador permite probar el canal sin credenciales. En producción con WhatsApp activo se apaga salvo WHATSAPP_SIMULADOR=on. */
export const simuladorHabilitado = () => process.env.WHATSAPP_SIMULADOR === "on" || (process.env.WHATSAPP_SIMULADOR !== "off" && !waActivo());

export function checklistActivacion() {
  const c = waConfig();
  return [
    { clave: "WHATSAPP_TOKEN", ok: !!c.token, ayuda: "Token permanente de un System User de Meta Business con permisos whatsapp_business_messaging y whatsapp_business_management." },
    { clave: "WHATSAPP_PHONE_NUMBER_ID", ok: !!c.phoneNumberId, ayuda: "ID del número de teléfono registrado en la cuenta de WhatsApp Business (no es el número en sí)." },
    { clave: "WHATSAPP_BUSINESS_ACCOUNT_ID", ok: !!c.wabaId, ayuda: "ID de la cuenta de WhatsApp Business (WABA), para gestionar plantillas." },
    { clave: "WHATSAPP_VERIFY_TOKEN", ok: !!c.verifyToken, ayuda: "Texto secreto que elegís y cargás al configurar el webhook en Meta." },
    { clave: "WHATSAPP_APP_SECRET", ok: !!c.appSecret, ayuda: "App Secret de la app de Meta: valida que los webhooks vengan de Meta." },
    { clave: "APP_URL", ok: !!process.env.APP_URL, ayuda: "URL pública HTTPS de la plataforma (el webhook es APP_URL/api/whatsapp/webhook)." },
    { clave: "Plantillas aprobadas", ok: false, ayuda: `Crear y aprobar en Meta las plantillas "${c.plantillaBienvenida}" y "${c.plantillaAviso}" (categoría Utility, idioma ${c.idioma}). Ver docs/whatsapp.md.` },
    { clave: "OPENAI_API_KEY (opcional)", ok: !!process.env.OPENAI_API_KEY, ayuda: "Para transcribir audios. Sin ella, los audios se guardan y se pide el texto." },
    { clave: "ANTHROPIC_API_KEY (opcional)", ok: !!process.env.ANTHROPIC_API_KEY, ayuda: "Para interpretar mensajes complejos, fotos y documentos. Sin ella funciona con reglas." },
  ];
}
