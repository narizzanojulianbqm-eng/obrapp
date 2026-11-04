/**
 * Datos de demostración. Ejecutar: npm run db:seed
 * Los precios cargados son FICTICIOS, solo para mostrar el funcionamiento (no son precios de mercado).
 */
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db, schema } from "../src/lib/db";
import { generarDesdePlantilla, recalcularObra } from "../src/lib/obra-service";
import { sumarHabiles, hoyISO } from "../src/lib/engine/calendario";

const PRECIOS_DEMO: Record<string, number> = {
  oficial: 9500, ayudante: 7800, oficial_esp: 11000, pintor: 9000, durlockero: 10000, hormigonera: 2500, andamio: 1800, volquete: 85000,
  cemento: 11500, cal: 6200, arena: 42000, piedra: 68000, cascote: 25000, tosca: 22000, hidrofugo: 2800, h21: 165000, hierro: 1900, alambre: 3500,
  clavos: 3800, encofrado: 6500, malla: 7400, vigueta: 9800, bloque_losa: 1450, ladrillo_hueco18: 1150, ladrillo_hueco12: 880, film: 900,
  membrana: 9900, eps: 6800, imprimacion: 4500, yeso: 9200, ceramico: 18000, porcelanato: 32000, piso_ext: 26000, adhesivo: 9800, pastina: 2400,
  zocalo: 5200, cable: 950, corrugado: 480, caja_luz: 650, tablero: 145000, sanit_agua: 420000, sanit_desague: 380000, gas_boca: 260000,
  artefactos_bano: 1350000, mesada: 780000, llaves: 9500, puerta_placa: 185000, puerta_acceso: 690000, ventana: 520000, latex_int: 6800,
  latex_ext: 9200, fijador: 5200, enduido: 2900, obrador: 1600000, perfil_steel: 5200, tornillos: 45, osb: 14500, barrera: 2600, basecoat: 3900,
  placa_yeso: 7600, masilla: 2900, cinta: 160, lana_vidrio: 6400, escombro: 85000,
};

async function usuario(nombre: string, email: string, telefono?: string) {
  const [u] = await db.insert(schema.users).values({ nombre, email, passwordHash: await bcrypt.hash("demo1234", 10), plan: "profesional", telefono }).returning();
  return u;
}

/** Agregados posteriores a la demo (idempotente: corre también sobre bases ya cargadas). */
async function completarDemo() {
  const obrero = await db.query.users.findFirst({ where: eq(schema.users.email, "obrero@demo.com") });
  const obra = await db.query.obras.findFirst({ where: eq(schema.obras.codigo, "OB-2026-0001") });
  if (!obrero || !obra) return;
  if (!obrero.dni) await db.update(schema.users).set({ dni: "30000000", pinHash: await bcrypt.hash("123456", 10) }).where(eq(schema.users.id, obrero.id));
  const hay = await db.query.partesDiarios.findFirst({ where: eq(schema.partesDiarios.obraId, obra.id) });
  if (hay) return;
  const f = (d: number) => sumarHabiles(hoyISO(), -d);
  await db.insert(schema.partesDiarios).values([
    { obraId: obra.id, autorId: obrero.id, fecha: f(1), personas: 4, horas: 8, clima: "bueno", trabajos: "Mampostería exterior lado norte. Llegó el hierro para la losa." },
    { obraId: obra.id, autorId: obrero.id, fecha: f(2), personas: 2, horas: 4, clima: "lluvia", trabajos: "Se trabajó medio día por lluvia. Ordenamos el obrador.", problema: "Se suspendió la tarde por lluvia" },
    { obraId: obra.id, autorId: obrero.id, fecha: f(3), personas: 4, horas: 8, clima: "nublado", trabajos: "Columnas del frente y encadenado." },
  ]);
}

async function main() {
  if (process.env.SEED_DEMO === "0") { console.log("SEED_DEMO=0: no se cargan datos de demostración."); return; }
  const ya = await db.query.users.findFirst({ where: eq(schema.users.email, "arquitecta@demo.com") });
  if (ya) { await completarDemo(); console.log("La base ya tiene datos de demo."); return; }

  const ana = await usuario("Ana Rossi", "arquitecta@demo.com", "5491150000001");
  const cliente = await usuario("Martín Pérez", "cliente@demo.com", "5491150000002");
  const obrero = await usuario("Carlos Gómez", "obrero@demo.com", "5491150000003");

  const inicio = sumarHabiles(hoyISO(), -32);
  const [obra] = await db.insert(schema.obras).values({
    ownerId: ana.id, codigo: "OB-2026-0001", nombre: "Vivienda Familia Pérez (DEMO)", direccion: "Los Aromos 1450", localidad: "Pilar", provincia: "Buenos Aires",
    tipo: "vivienda_unifamiliar", sistema: "tradicional", supCubierta: 140, supSemicubierta: 20, niveles: 2, fechaInicio: inicio, duracionEstimadaDias: 200,
    clienteNombre: "Martín Pérez", clienteEmail: "cliente@demo.com", clienteTelefono: "11 5000 0002", arquitectoResponsable: "Arq. Ana Rossi",
    caracteristicas: "3 dormitorios, 2 baños, cubierta plana, aberturas de aluminio, pisos de porcelanato.", presupuestoInicial: 150000000, parametros: {},
  }).returning();
  const [mCli] = await db.insert(schema.miembros).values({ obraId: obra.id, userId: cliente.id, email: cliente.email, nombre: cliente.nombre, rol: "cliente" }).returning();
  const [mObr] = await db.insert(schema.miembros).values({ obraId: obra.id, userId: obrero.id, email: obrero.email, nombre: obrero.nombre, rol: "obrero", oficio: "Capataz" }).returning();
  void mCli;
  await generarDesdePlantilla(obra);

  // precios de demostración
  const ins = await db.query.insumos.findMany({ where: eq(schema.insumos.obraId, obra.id) });
  for (const i of ins) if (i.clave && PRECIOS_DEMO[i.clave]) await db.update(schema.insumos).set({ precio: PRECIOS_DEMO[i.clave], precioActualizado: new Date() }).where(eq(schema.insumos.id, i.id));

  // avances: lo que ya debería estar hecho, con algún atraso
  const its = await db.query.items.findMany({ where: eq(schema.items.obraId, obra.id) });
  const avance: Record<string, number> = { inicio: 100, obrador: 100, limpieza_terreno: 100, replanteo: 100, excavacion: 100, cimientos: 100, capa_aisladora: 100, relleno: 60, muro_ext: 45, muro_int: 10 };
  for (const it of its) {
    const v = avance[it.plantillaKey ?? ""];
    const set: Partial<typeof schema.items.$inferInsert> = {};
    if (v != null) set.avanceReal = v;
    if (["excavacion", "cimientos", "capa_aisladora", "relleno", "muro_ext", "muro_int", "columnas"].includes(it.plantillaKey ?? "")) set.asignadoA = mObr.id;
    if (Object.keys(set).length) await db.update(schema.items).set(set).where(eq(schema.items.id, it.id));
    if (v && v < 100) await db.insert(schema.avances).values({ obraId: obra.id, itemId: it.id, autorId: obrero.id, avancePct: v, nota: "Avance informado por el capataz" });
  }
  await recalcularObra(obra.id);

  // proveedores, compras y una solicitud pendiente
  const [p1] = await db.insert(schema.proveedores).values({ ownerId: ana.id, nombre: "Corralón San Martín", rubro: "Corralón", localidad: "Pilar", email: "ventas@corralon-demo.com", whatsapp: "11 4000 1000", canal: "whatsapp" }).returning();
  const [p2] = await db.insert(schema.proveedores).values({ ownerId: ana.id, nombre: "Materiales Del Viso", rubro: "Corralón", localidad: "Del Viso", email: "pedidos@delviso-demo.com", canal: "email" }).returning();
  void p2;
  const rubros = await db.query.rubros.findMany({ where: eq(schema.rubros.obraId, obra.id) });
  const rb = (n: string) => rubros.find((r) => r.nombre === n)?.id ?? null;
  const fecha = (d: number) => sumarHabiles(hoyISO(), -d);
  const compras = [
    { descripcion: "Hormigón elaborado H-21", cantidad: 9, unidad: "m3", precio: 165000, rubro: "Estructuras", d: 20 },
    { descripcion: "Acero ADN 420", cantidad: 620, unidad: "kg", precio: 1900, rubro: "Estructuras", d: 22 },
    { descripcion: "Ladrillo hueco portante 18", cantidad: 1800, unidad: "u", precio: 1150, rubro: "Albañilería", d: 8 },
    { descripcion: "Cemento portland", cantidad: 60, unidad: "bolsa", precio: 11500, rubro: "Albañilería", d: 3 },
    { descripcion: "Obrador y cerco", cantidad: 1, unidad: "gl", precio: 1600000, rubro: "Trabajos preliminares", d: 30 },
  ];
  for (const c of compras) await db.insert(schema.compras).values({ obraId: obra.id, proveedorId: p1.id, rubroId: rb(c.rubro), descripcion: c.descripcion, cantidad: c.cantidad, unidad: c.unidad, precioUnitario: c.precio, total: c.cantidad * c.precio, fecha: fecha(c.d), estado: c.d > 5 ? "pagada" : "recibida", pagado: c.d > 5 ? c.cantidad * c.precio : 0 });
  const arena = ins.find((i) => i.clave === "arena");
  await db.insert(schema.solicitudes).values({ obraId: obra.id, solicitanteId: obrero.id, material: arena!.nombre, insumoId: arena!.id, cantidad: 4, unidad: "m3", prioridad: "alta", observaciones: "Para seguir con la mampostería", fechaNecesaria: sumarHabiles(hoyISO(), 1) });

  await db.insert(schema.mensajes).values([
    { obraId: obra.id, canal: "cliente", autorId: cliente.id, texto: "Hola Ana, ¿cómo vienen con las paredes?" },
    { obraId: obra.id, canal: "cliente", autorId: ana.id, texto: "Hola Martín, estamos con la mampostería exterior, vamos un poco demorados por la lluvia de la semana pasada." },
    { obraId: obra.id, canal: "obra", autorId: ana.id, tipo: "decision", texto: "Se define dintel de HºAº en todas las aberturas del frente." },
  ]);

  // WhatsApp: los tres vinculados (modo simulador)
  await db.insert(schema.waContactos).values([
    { telefono: "5491150000001", userId: ana.id, nombre: ana.nombre, estado: "activo", obraActivaId: obra.id },
    { telefono: "5491150000002", userId: cliente.id, nombre: cliente.nombre, estado: "activo", obraActivaId: obra.id, invitadoPor: ana.id },
    { telefono: "5491150000003", userId: obrero.id, nombre: obrero.nombre, estado: "activo", obraActivaId: obra.id, invitadoPor: ana.id },
  ]);

  // Segunda obra de la arquitecta (steel frame) para probar selección de obra
  const [obra2] = await db.insert(schema.obras).values({
    ownerId: ana.id, codigo: "OB-2026-0002", nombre: "Ampliación Quincho Benítez (DEMO)", direccion: "Ruta 25 km 3", localidad: "Escobar", provincia: "Buenos Aires",
    tipo: "ampliacion", sistema: "steel_frame", supCubierta: 45, supSemicubierta: 15, niveles: 1, fechaInicio: sumarHabiles(hoyISO(), 10), parametros: {},
  }).returning();
  await generarDesdePlantilla(obra2);
  await completarDemo();
  console.log("Demo creada. Usuarios: arquitecta@demo.com / cliente@demo.com / obrero@demo.com — contraseña demo1234");
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
