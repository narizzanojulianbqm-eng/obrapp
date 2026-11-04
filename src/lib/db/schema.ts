import { sqliteTable, text, integer, real, index, blob } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

const id = () => text("id").primaryKey().$defaultFn(() => crypto.randomUUID());
const createdAt = () => integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`);

// ───────────── Usuarios y planes ─────────────
export const users = sqliteTable("users", {
  id: id(),
  email: text("email").notNull().unique(),
  nombre: text("nombre").notNull(),
  passwordHash: text("password_hash").notNull(),
  plan: text("plan", { enum: ["gratuito", "profesional", "estudio"] }).notNull().default("gratuito"),
  telefono: text("telefono"),
  avisosEmail: integer("avisos_email", { mode: "boolean" }).notNull().default(true),
  // acceso simple para el equipo de obra: DNI + PIN de 6 dígitos (sin email ni contraseña)
  dni: text("dni").unique(),
  pinHash: text("pin_hash"),
  createdAt: createdAt(),
});

export const resetTokens = sqliteTable("reset_tokens", {
  id: id(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  hash: text("hash").notNull(), // sha256 del código o token: nunca se guarda en claro
  expira: integer("expira", { mode: "timestamp" }).notNull(),
  usado: integer("usado", { mode: "boolean" }).notNull().default(false),
  createdAt: createdAt(),
});

/** Freno a intentos repetidos de login / recuperación (por email). */
export const intentosAcceso = sqliteTable("intentos_acceso", {
  clave: text("clave").primaryKey(),
  fallos: integer("fallos").notNull().default(0),
  bloqueadoHasta: integer("bloqueado_hasta", { mode: "timestamp" }),
  actualizado: integer("actualizado", { mode: "timestamp" }),
});

export const suscripciones = sqliteTable("suscripciones", {
  id: id(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  plan: text("plan", { enum: ["profesional", "estudio"] }).notNull(),
  estado: text("estado", { enum: ["pendiente", "activa", "pausada", "cancelada"] }).notNull().default("pendiente"),
  proveedor: text("proveedor").notNull().default("mercadopago"),
  idExterno: text("id_externo"), // preapproval id
  monto: real("monto").notNull(),
  checkoutUrl: text("checkout_url"),
  createdAt: createdAt(),
});

// ───────────── Obras ─────────────
export const obras = sqliteTable("obras", {
  id: id(),
  ownerId: text("owner_id").notNull().references(() => users.id),
  codigo: text("codigo").notNull(), // identificador legible, ej. OB-2026-0001
  nombre: text("nombre").notNull(),
  direccion: text("direccion"),
  localidad: text("localidad"),
  provincia: text("provincia"),
  tipo: text("tipo").notNull(), // ver engine/templates TIPOS_OBRA
  sistema: text("sistema").notNull(), // ver engine/templates SISTEMAS
  supCubierta: real("sup_cubierta").notNull().default(0),
  supSemicubierta: real("sup_semicubierta").notNull().default(0),
  niveles: integer("niveles").notNull().default(1),
  fechaInicio: text("fecha_inicio").notNull(), // YYYY-MM-DD
  duracionEstimadaDias: integer("duracion_estimada_dias"),
  clienteNombre: text("cliente_nombre"),
  clienteEmail: text("cliente_email"),
  clienteTelefono: text("cliente_telefono"),
  arquitectoResponsable: text("arquitecto_responsable"),
  caracteristicas: text("caracteristicas"),
  presupuestoInicial: real("presupuesto_inicial"),
  estado: text("estado", { enum: ["activa", "pausada", "finalizada"] }).notNull().default("activa"),
  // Parámetros geométricos / constructivos usados por el cómputo (JSON, editables)
  parametros: text("parametros", { mode: "json" }).$type<Record<string, number>>().notNull().default({}),
  // Coeficientes del presupuesto (%)
  gastosGeneralesPct: real("gastos_generales_pct").notNull().default(10),
  beneficioPct: real("beneficio_pct").notNull().default(10),
  honorariosPct: real("honorarios_pct").notNull().default(8),
  ivaPct: real("iva_pct").notNull().default(0),
  cuadrillaHHdia: real("cuadrilla_hh_dia").notNull().default(16), // horas-hombre por día de una cuadrilla tipo
  clientePuedeVerDetalle: integer("cliente_puede_ver_detalle", { mode: "boolean" }).notNull().default(false),
  // secciones que el arquitecto habilita en el portal del cliente
  portalCliente: text("portal_cliente", { mode: "json" }).$type<Partial<Record<"cronograma" | "avances" | "presupuesto" | "compras" | "documentos" | "mensajes" | "asistente", boolean>>>().notNull().default({}),
  createdAt: createdAt(),
});

export const miembros = sqliteTable(
  "miembros",
  {
    id: id(),
    obraId: text("obra_id").notNull().references(() => obras.id, { onDelete: "cascade" }),
    userId: text("user_id").references(() => users.id),
    email: text("email").notNull(),
    nombre: text("nombre"),
    rol: text("rol", { enum: ["arquitecto", "cliente", "obrero"] }).notNull(),
    oficio: text("oficio"),
    createdAt: createdAt(),
  },
  (t) => [index("miembros_obra_idx").on(t.obraId), index("miembros_email_idx").on(t.email)],
);

// ───────────── Planificación y cómputo ─────────────
export const rubros = sqliteTable("rubros", {
  id: id(),
  obraId: text("obra_id").notNull().references(() => obras.id, { onDelete: "cascade" }),
  orden: integer("orden").notNull(),
  codigo: text("codigo").notNull(),
  nombre: text("nombre").notNull(),
});

export const items = sqliteTable(
  "items",
  {
    id: id(),
    obraId: text("obra_id").notNull().references(() => obras.id, { onDelete: "cascade" }),
    rubroId: text("rubro_id").notNull().references(() => rubros.id, { onDelete: "cascade" }),
    orden: integer("orden").notNull(),
    plantillaKey: text("plantilla_key"), // clave de la plantilla que lo generó
    nombre: text("nombre").notNull(),
    unidad: text("unidad").notNull(),
    formula: text("formula"), // clave de fórmula de cómputo
    cantidadCalc: real("cantidad_calc").notNull().default(0),
    cantidadManual: real("cantidad_manual"), // si no es null, prevalece
    hhPorUnidad: real("hh_por_unidad").notNull().default(0), // rendimiento: horas-hombre por unidad
    duracionManual: integer("duracion_manual"),
    duracion: integer("duracion").notNull().default(1), // días hábiles (calculada o manual)
    predecesoras: text("predecesoras", { mode: "json" }).$type<{ id: string; tipo: "FC" | "CC"; desfase: number }[]>().notNull().default([]),
    inicioMin: text("inicio_min"), // restricción "no antes de" fijada por el arquitecto (drag en Gantt)
    inicio: text("inicio"), // calculado
    fin: text("fin"), // calculado
    esHito: integer("es_hito", { mode: "boolean" }).notNull().default(false),
    avanceReal: real("avance_real").notNull().default(0), // 0-100
    cantidadEjecutada: real("cantidad_ejecutada").notNull().default(0),
    asignadoA: text("asignado_a"), // miembro id
    notas: text("notas"),
  },
  (t) => [index("items_obra_idx").on(t.obraId)],
);

// Insumos de la obra (lista de precios propia de cada obra). Los precios los carga el arquitecto.
export const insumos = sqliteTable("insumos", {
  id: id(),
  obraId: text("obra_id").notNull().references(() => obras.id, { onDelete: "cascade" }),
  clave: text("clave"),
  tipo: text("tipo", { enum: ["material", "mano_obra", "equipo"] }).notNull(),
  nombre: text("nombre").notNull(),
  unidad: text("unidad").notNull(),
  precio: real("precio").notNull().default(0),
  precioActualizado: integer("precio_actualizado", { mode: "timestamp" }),
});

// Composición del análisis de precios: cuánto de cada insumo consume una unidad del ítem
export const recursos = sqliteTable("recursos", {
  id: id(),
  itemId: text("item_id").notNull().references(() => items.id, { onDelete: "cascade" }),
  insumoId: text("insumo_id").notNull().references(() => insumos.id, { onDelete: "cascade" }),
  consumo: real("consumo").notNull(), // por unidad de ítem (incluye desperdicio)
});

export const avances = sqliteTable("avances", {
  id: id(),
  obraId: text("obra_id").notNull().references(() => obras.id, { onDelete: "cascade" }),
  itemId: text("item_id").notNull().references(() => items.id, { onDelete: "cascade" }),
  autorId: text("autor_id").notNull().references(() => users.id),
  avancePct: real("avance_pct").notNull(),
  cantidad: real("cantidad"),
  nota: text("nota"),
  tipo: text("tipo", { enum: ["avance", "problema"] }).notNull().default("avance"),
  fotos: text("fotos", { mode: "json" }).$type<string[]>().notNull().default([]),
  origen: text("origen", { enum: ["web", "whatsapp"] }).notNull().default("web"),
  createdAt: createdAt(),
});

// ───────────── Compras y proveedores ─────────────
export const proveedores = sqliteTable("proveedores", {
  id: id(),
  ownerId: text("owner_id").notNull().references(() => users.id),
  nombre: text("nombre").notNull(),
  rubro: text("rubro"),
  localidad: text("localidad"),
  direccion: text("direccion"),
  telefono: text("telefono"),
  whatsapp: text("whatsapp"),
  email: text("email"),
  canal: text("canal", { enum: ["email", "whatsapp", "telefono", "api", "catalogo"] }).notNull().default("email"),
  notas: text("notas"),
  createdAt: createdAt(),
});

export const solicitudes = sqliteTable("solicitudes", {
  id: id(),
  obraId: text("obra_id").notNull().references(() => obras.id, { onDelete: "cascade" }),
  solicitanteId: text("solicitante_id").notNull().references(() => users.id),
  tipo: text("tipo", { enum: ["material", "herramienta"] }).notNull().default("material"),
  material: text("material").notNull(),
  insumoId: text("insumo_id"),
  cantidad: real("cantidad").notNull(),
  unidad: text("unidad").notNull(),
  fechaNecesaria: text("fecha_necesaria"),
  itemId: text("item_id"),
  observaciones: text("observaciones"),
  prioridad: text("prioridad", { enum: ["baja", "media", "alta", "urgente"] }).notNull().default("media"),
  fotos: text("fotos", { mode: "json" }).$type<string[]>().notNull().default([]),
  estado: text("estado", { enum: ["pendiente", "aprobada", "rechazada", "en_compra", "entregada"] }).notNull().default("pendiente"),
  respuesta: text("respuesta"),
  origen: text("origen", { enum: ["web", "whatsapp", "asistente"] }).notNull().default("web"),
  createdAt: createdAt(),
});

// Pedido de cotización (estructura preparada para email / WhatsApp / API de proveedores)
export const cotizaciones = sqliteTable("cotizaciones", {
  id: id(),
  obraId: text("obra_id").notNull().references(() => obras.id, { onDelete: "cascade" }),
  titulo: text("titulo").notNull(),
  lineas: text("lineas", { mode: "json" }).$type<{ insumoId?: string; descripcion: string; cantidad: number; unidad: string }[]>().notNull().default([]),
  estado: text("estado", { enum: ["borrador", "enviada", "cerrada"] }).notNull().default("borrador"),
  createdAt: createdAt(),
});

export const respuestasCotizacion = sqliteTable("respuestas_cotizacion", {
  id: id(),
  cotizacionId: text("cotizacion_id").notNull().references(() => cotizaciones.id, { onDelete: "cascade" }),
  proveedorId: text("proveedor_id").notNull().references(() => proveedores.id),
  precios: text("precios", { mode: "json" }).$type<number[]>().notNull().default([]), // precio unitario por línea
  envio: real("envio").notNull().default(0),
  plazoEntregaDias: integer("plazo_entrega_dias"),
  condicionesPago: text("condiciones_pago"),
  disponibilidad: text("disponibilidad"),
  canalEnvio: text("canal_envio"), // registro de cómo se pidió (email, whatsapp, formulario)
  estado: text("estado", { enum: ["pendiente", "recibida", "elegida", "descartada"] }).notNull().default("pendiente"),
  token: text("token").$defaultFn(() => crypto.randomUUID().replace(/-/g, "")), // link del portal de proveedores
  enviadaEn: integer("enviada_en", { mode: "timestamp" }),
  respondidaPor: text("respondida_por", { enum: ["proveedor", "arquitecto"] }),
  respondidaEn: integer("respondida_en", { mode: "timestamp" }),
  notasProveedor: text("notas_proveedor"),
  estadoPedido: text("estado_pedido", { enum: ["sin_pedido", "enviado", "confirmado", "entregado"] }).notNull().default("sin_pedido"),
  fechaEntrega: text("fecha_entrega"),
  createdAt: createdAt(),
});

export const compras = sqliteTable("compras", {
  id: id(),
  obraId: text("obra_id").notNull().references(() => obras.id, { onDelete: "cascade" }),
  proveedorId: text("proveedor_id"),
  rubroId: text("rubro_id"),
  insumoId: text("insumo_id"),
  solicitudId: text("solicitud_id"),
  respuestaId: text("respuesta_id"), // pedido generado desde una cotización
  descripcion: text("descripcion").notNull(),
  cantidad: real("cantidad").notNull().default(1),
  unidad: text("unidad").notNull().default("gl"),
  precioUnitario: real("precio_unitario").notNull().default(0),
  total: real("total").notNull().default(0),
  fecha: text("fecha").notNull(),
  estado: text("estado", { enum: ["prevista", "pedida", "recibida", "pagada"] }).notNull().default("prevista"),
  pagado: real("pagado").notNull().default(0),
  requiereAprobacionCliente: integer("requiere_aprobacion_cliente", { mode: "boolean" }).notNull().default(false),
  aprobacionCliente: text("aprobacion_cliente", { enum: ["pendiente", "aprobada", "rechazada"] }),
  createdAt: createdAt(),
});

// Presupuestos adicionales que el cliente aprueba o rechaza
export const adicionales = sqliteTable("adicionales", {
  id: id(),
  obraId: text("obra_id").notNull().references(() => obras.id, { onDelete: "cascade" }),
  titulo: text("titulo").notNull(),
  descripcion: text("descripcion"),
  monto: real("monto").notNull(),
  estado: text("estado", { enum: ["pendiente", "aprobado", "rechazado"] }).notNull().default("pendiente"),
  respuestaCliente: text("respuesta_cliente"),
  createdAt: createdAt(),
});

// ───────────── Comunicación y documentos ─────────────
export const mensajes = sqliteTable(
  "mensajes",
  {
    id: id(),
    obraId: text("obra_id").notNull().references(() => obras.id, { onDelete: "cascade" }),
    canal: text("canal").notNull(), // general | cliente | obra | item:<id>
    autorId: text("autor_id").notNull().references(() => users.id),
    tipo: text("tipo", { enum: ["mensaje", "decision", "cambio", "observacion", "sistema"] }).notNull().default("mensaje"),
    texto: text("texto").notNull(),
    adjuntos: text("adjuntos", { mode: "json" }).$type<string[]>().notNull().default([]),
    origen: text("origen", { enum: ["web", "whatsapp", "sistema"] }).notNull().default("web"),
    createdAt: createdAt(),
  },
  (t) => [index("mensajes_obra_canal_idx").on(t.obraId, t.canal)],
);

export const documentos = sqliteTable("documentos", {
  id: id(),
  obraId: text("obra_id").notNull().references(() => obras.id, { onDelete: "cascade" }),
  subidoPor: text("subido_por").notNull().references(() => users.id),
  nombre: text("nombre").notNull(),
  ruta: text("ruta").notNull(),
  mime: text("mime"),
  tamano: integer("tamano"),
  categoria: text("categoria").notNull().default("general"), // plano | foto | contrato | general
  visibleCliente: integer("visible_cliente", { mode: "boolean" }).notNull().default(true),
  visibleObrero: integer("visible_obrero", { mode: "boolean" }).notNull().default(true),
  createdAt: createdAt(),
});

/** Contenido de archivos cuando no hay disco persistente (Vercel): se guarda en la base. */
export const archivosContenido = sqliteTable("archivos_contenido", {
  docId: text("doc_id").primaryKey().references(() => documentos.id, { onDelete: "cascade" }),
  data: blob("data", { mode: "buffer" }).notNull(),
});

export const notificaciones = sqliteTable(
  "notificaciones",
  {
    id: id(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    obraId: text("obra_id"),
    texto: text("texto").notNull(),
    link: text("link"),
    leida: integer("leida", { mode: "boolean" }).notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [index("notif_user_idx").on(t.userId)],
);

// ───────────── IA y auditoría ─────────────
export const aiMensajes = sqliteTable("ai_mensajes", {
  id: id(),
  obraId: text("obra_id").notNull().references(() => obras.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id),
  rol: text("rol", { enum: ["user", "assistant"] }).notNull(),
  texto: text("texto").notNull(),
  acciones: text("acciones", { mode: "json" }).$type<unknown[]>(),
  createdAt: createdAt(),
});

export const aiUso = sqliteTable("ai_uso", {
  id: id(),
  userId: text("user_id").notNull().references(() => users.id),
  obraId: text("obra_id"),
  modelo: text("modelo"),
  tokensEntrada: integer("tokens_entrada").notNull().default(0),
  tokensSalida: integer("tokens_salida").notNull().default(0),
  createdAt: createdAt(),
});

export const auditoria = sqliteTable("auditoria", {
  id: id(),
  obraId: text("obra_id"),
  userId: text("user_id"),
  accion: text("accion").notNull(),
  detalle: text("detalle"),
  createdAt: createdAt(),
});

export type Obra = typeof obras.$inferSelect;
export type Item = typeof items.$inferSelect;
export type Rubro = typeof rubros.$inferSelect;
export type Insumo = typeof insumos.$inferSelect;
export type Recurso = typeof recursos.$inferSelect;
export type Rol = "arquitecto" | "cliente" | "obrero";

// ───────────── WhatsApp (canal adicional sobre el mismo sistema) ─────────────
/** Número de WhatsApp vinculado a un usuario. Un número = un usuario. */
export const waContactos = sqliteTable("wa_contactos", {
  id: id(),
  telefono: text("telefono").notNull().unique(), // E.164 sin "+", ej. 5491155554444
  userId: text("user_id").references(() => users.id, { onDelete: "cascade" }),
  nombre: text("nombre"),
  estado: text("estado", { enum: ["invitado", "activo", "bloqueado"] }).notNull().default("invitado"),
  codigoVinculacion: text("codigo_vinculacion"), // código de 6 dígitos que confirma el número
  codigoExpira: integer("codigo_expira", { mode: "timestamp" }),
  obraActivaId: text("obra_activa_id"), // obra seleccionada en la conversación
  ultimoEntrante: integer("ultimo_entrante", { mode: "timestamp" }), // abre la ventana de 24 h de WhatsApp
  notificaciones: integer("notificaciones", { mode: "boolean" }).notNull().default(true),
  invitadoPor: text("invitado_por"),
  createdAt: createdAt(),
});

/** Registro de todos los mensajes del canal (entrantes y salientes) para historial y trazabilidad. */
export const waMensajes = sqliteTable(
  "wa_mensajes",
  {
    id: id(),
    contactoId: text("contacto_id").notNull().references(() => waContactos.id, { onDelete: "cascade" }),
    obraId: text("obra_id"),
    direccion: text("direccion", { enum: ["entrante", "saliente"] }).notNull(),
    tipo: text("tipo").notNull(), // text | audio | image | video | document | interactive | template
    texto: text("texto"),
    transcripcion: text("transcripcion"),
    mediaDocId: text("media_doc_id"),
    opciones: text("opciones", { mode: "json" }).$type<{ id: string; titulo: string }[]>(), // botones / lista interactiva
    waMessageId: text("wa_message_id"),
    intencion: text("intencion"), // consulta | observacion | solicitud | instruccion | accion_sensible | ...
    estado: text("estado").notNull().default("recibido"), // recibido | procesado | enviado | entregado | leido | error | simulado
    error: text("error"),
    createdAt: createdAt(),
  },
  (t) => [index("wa_msg_contacto_idx").on(t.contactoId)],
);

/** Estado conversacional pendiente (confirmaciones "SÍ/NO", elegir obra, aclaraciones). Vale para todos los canales. */
export const conversacionPendientes = sqliteTable("conversacion_pendientes", {
  id: id(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  canal: text("canal", { enum: ["web", "whatsapp"] }).notNull(),
  obraId: text("obra_id"),
  tipo: text("tipo").notNull(), // confirmar | elegir_obra | elegir_item | avance_pct
  payload: text("payload", { mode: "json" }).$type<Record<string, unknown>>().notNull(),
  descripcion: text("descripcion").notNull(),
  expira: integer("expira", { mode: "timestamp" }).notNull(),
  createdAt: createdAt(),
});

/** Propuestas de cambio pedidas por el cliente: se evalúa impacto económico y temporal antes de ejecutar. */
export const cambios = sqliteTable("cambios", {
  id: id(),
  obraId: text("obra_id").notNull().references(() => obras.id, { onDelete: "cascade" }),
  solicitanteId: text("solicitante_id").notNull().references(() => users.id),
  descripcion: text("descripcion").notNull(),
  itemsAfectados: text("items_afectados", { mode: "json" }).$type<string[]>().notNull().default([]),
  costoAfectado: real("costo_afectado"), // costo actual (precio final) de los ítems afectados
  impactoMonto: real("impacto_monto"), // lo completa el arquitecto
  impactoDias: integer("impacto_dias"),
  respuestaArquitecto: text("respuesta_arquitecto"),
  estado: text("estado", { enum: ["solicitado", "evaluado", "aprobado", "rechazado"] }).notNull().default("solicitado"),
  adicionalId: text("adicional_id"),
  origen: text("origen", { enum: ["web", "whatsapp"] }).notNull().default("web"),
  createdAt: createdAt(),
});

/** Parte diario de obra: quiénes trabajaron, cuántas horas, qué se hizo, clima, problema y fotos. */
export const partesDiarios = sqliteTable(
  "partes_diarios",
  {
    id: id(),
    obraId: text("obra_id").notNull().references(() => obras.id, { onDelete: "cascade" }),
    autorId: text("autor_id").notNull().references(() => users.id),
    fecha: text("fecha").notNull(), // YYYY-MM-DD
    personas: integer("personas").notNull().default(0),
    horas: real("horas").notNull().default(0), // horas por persona
    clima: text("clima", { enum: ["bueno", "nublado", "lluvia", "viento", "calor", "frio"] }).notNull().default("bueno"),
    trabajos: text("trabajos"),
    problema: text("problema"),
    fotos: text("fotos", { mode: "json" }).$type<string[]>().notNull().default([]),
    origen: text("origen", { enum: ["web", "whatsapp"] }).notNull().default("web"),
    createdAt: createdAt(),
  },
  (t) => [index("partes_obra_fecha_idx").on(t.obraId, t.fecha)],
);
