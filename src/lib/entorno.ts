/** Entorno de prueba: muestra el aviso de datos ficticios y los accesos de demostración en el login. */
export const modoDemo = () => process.env.DEMO_MODE !== "0";
export const DEMO_CUENTAS = [
  { email: "arquitecta@demo.com", label: "Arquitecta", detalle: "Ve todo: costos, honorarios, WhatsApp" },
  { email: "cliente@demo.com", label: "Cliente", detalle: "Avance, presupuesto final y aprobaciones" },
  { email: "obrero@demo.com", label: "Obrero", detalle: "Parte diario, avances y pedidos (también entra con DNI 30000000 y PIN 123456)" },
];
