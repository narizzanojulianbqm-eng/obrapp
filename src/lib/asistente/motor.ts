import "server-only";
/**
 * MOTOR DE CONVERSACIÓN — punto único de entrada para todos los canales (WhatsApp, asistente web, futura app).
 *
 * Recibe un mensaje normalizado (texto + medios), identifica obra y perfil, clasifica la intención
 * (consulta · observación · solicitud · instrucción · acción que requiere autorización) y ejecuta
 * sobre la MISMA base de datos que usa la web. Las consultas se responden con datos reales;
 * la IA solo se usa para interpretar lenguaje difícil, fotos y preguntas abiertas.
 */
import { and, desc, eq, gt } from "drizzle-orm";
import { db, schema } from "../db";
import type { Item, Rol } from "../db/schema";
import { auditar, notificar, rolEnObra } from "../access";
import { obrasDelUsuario, resumenObra } from "../queries";
import { guardarArchivos } from "../files";
import { hoyISO } from "../engine/calendario";
import { ars, num } from "../format";
import * as Q from "./consultas";
import { esNo, esSi, extraerMateriales, extraerNumeroLista, extraerPorcentaje, matchItems, normalizar } from "./texto";
import { interpretarConIA, responderLibre, type Interpretacion } from "./ia";
import { aiDisponible, cupoIA } from "../ai";
import { describirImagen } from "../whatsapp/medios";

export type Medio = { buf: Buffer; mime: string; nombre: string; tipo: "image" | "audio" | "video" | "document"; transcripcion?: string | null };
export type Entrada = { userId: string; canal: "web" | "whatsapp"; texto: string; medios?: Medio[]; obraId?: string; contactoId?: string };
export type Respuesta = { texto: string; media?: string[]; opciones?: { id: string; titulo: string }[] };
export type Salida = { respuestas: Respuesta[]; intencion: string; obraId: string | null };

type Ctx = {
  user: typeof schema.users.$inferSelect;
  canal: "web" | "whatsapp";
  obras: Awaited<ReturnType<typeof obrasDelUsuario>>;
  contacto?: typeof schema.waContactos.$inferSelect;
};
type CtxObra = Ctx & { obraId: string; obraNombre: string; rol: Rol; miembroId: string | null };

const MIN = 60 * 1000;
const r = (texto: string, media?: string[], opciones?: { id: string; titulo: string }[]): Respuesta => ({ texto, media, opciones });
const op = (valor: string, titulo?: string) => ({ id: `op:${valor}`, titulo: titulo ?? valor });
const SI_NO = [op("si", "Sí"), op("no", "No")];

// ───────── Estado conversacional ─────────
async function pendienteActual(userId: string, canal: string) {
  return db.query.conversacionPendientes.findFirst({
    where: and(eq(schema.conversacionPendientes.userId, userId), eq(schema.conversacionPendientes.canal, canal as "web"), gt(schema.conversacionPendientes.expira, new Date())),
    orderBy: desc(schema.conversacionPendientes.createdAt),
  });
}
async function limpiarPendientes(userId: string, canal: string) {
  await db.delete(schema.conversacionPendientes).where(and(eq(schema.conversacionPendientes.userId, userId), eq(schema.conversacionPendientes.canal, canal as "web")));
}
async function crearPendiente(ctx: Ctx, obraId: string | null, tipo: string, payload: Record<string, unknown>, descripcion: string, minutos = 30) {
  await limpiarPendientes(ctx.user.id, ctx.canal);
  await db.insert(schema.conversacionPendientes).values({ userId: ctx.user.id, canal: ctx.canal, obraId, tipo, payload, descripcion, expira: new Date(Date.now() + minutos * MIN) });
}

async function fijarObraActiva(ctx: Ctx, obraId: string) {
  if (ctx.contacto) {
    await db.update(schema.waContactos).set({ obraActivaId: obraId }).where(eq(schema.waContactos.id, ctx.contacto.id));
    ctx.contacto.obraActivaId = obraId;
  }
}

// ───────── Entrada principal ─────────
export async function procesar(e: Entrada): Promise<Salida> {
  const user = await db.query.users.findFirst({ where: eq(schema.users.id, e.userId) });
  if (!user) return { respuestas: [r("No encontré tu usuario.")], intencion: "error", obraId: null };
  const contacto = e.contactoId ? await db.query.waContactos.findFirst({ where: eq(schema.waContactos.id, e.contactoId) }) : undefined;
  const ctx: Ctx = { user, canal: e.canal, obras: await obrasDelUsuario(user), contacto };
  if (!ctx.obras.length) return { respuestas: [r("Todavía no estás vinculado a ninguna obra. Pedile al arquitecto que te sume.")], intencion: "sin_obras", obraId: null };

  const texto = (e.texto ?? "").trim();
  const t = normalizar(texto);

  // 1) ¿Responde a algo pendiente? (confirmación, elección de obra, aclaración)
  const pend = await pendienteActual(user.id, e.canal);
  if (pend) {
    const res = await resolverPendiente(ctx, pend, texto, e);
    if (res) return res;
  }

  // 2) Comandos globales
  if (/^(obras|mis obras|cambiar( de)? obra|otra obra|elegir obra)$/.test(t)) return elegirObra(ctx, "");
  if (/informe semanal|reporte semanal|resumen semanal/.test(t) && ctx.obras.some((o) => o.rol === "arquitecto")) {
    return { respuestas: [await Q.informeSemanal(user)], intencion: "consulta.informe_semanal", obraId: null };
  }

  // 3) Obra
  const obraSel = await resolverObra(ctx, e, t);
  if ("preguntar" in obraSel) {
    if (texto || e.medios?.length) await crearPendiente(ctx, null, "elegir_obra", { texto, medios: (e.medios ?? []).length }, "Elegir obra", 15);
    pendientesMedios.set(user.id, e.medios ?? []);
    return obraSel.preguntar;
  }
  const o = ctx.obras.find((x) => x.obra.id === obraSel.obraId)!;
  const c: CtxObra = { ...ctx, obraId: o.obra.id, obraNombre: o.obra.nombre, rol: o.rol, miembroId: o.miembroId ?? null };
  return manejar(c, texto, e.medios ?? []);
}

/** Medios recibidos mientras se pregunta la obra (se procesan cuando el usuario elige). */
const pendientesMedios = new Map<string, Medio[]>();

async function resolverObra(ctx: Ctx, e: Entrada, t: string): Promise<{ obraId: string } | { preguntar: Salida }> {
  const ids = ctx.obras.map((o) => o.obra.id);
  if (e.obraId && ids.includes(e.obraId)) return { obraId: e.obraId };
  // mención explícita de una de SUS obras (nunca se accede a otra obra por nombre o dirección)
  const mencion = ctx.obras.find((o) => normalizar(o.obra.nombre).split(" ").filter((w) => w.length > 3).some((w) => t.includes(w)) && t.includes("obra"));
  if (mencion) { await fijarObraActiva(ctx, mencion.obra.id); return { obraId: mencion.obra.id }; }
  if (ctx.contacto?.obraActivaId && ids.includes(ctx.contacto.obraActivaId)) return { obraId: ctx.contacto.obraActivaId };
  const activas = ctx.obras.filter((o) => o.obra.estado !== "finalizada");
  if (activas.length === 1) { await fijarObraActiva(ctx, activas[0].obra.id); return { obraId: activas[0].obra.id }; }
  return { preguntar: await elegirObra(ctx, "Tenés varias obras. ") };
}

async function elegirObra(ctx: Ctx, prefijo: string): Promise<Salida> {
  const activas = ctx.obras.filter((o) => o.obra.estado !== "finalizada");
  await crearPendiente(ctx, null, "elegir_obra", { texto: "" }, "Elegir obra", 15);
  return {
    respuestas: [r(`${prefijo}¿Sobre qué obra?\n${activas.map((o, i) => `${i + 1}. ${o.obra.nombre}${o.obra.localidad ? ` (${o.obra.localidad})` : ""}`).join("\n")}\n\nRespondé con el número.`, undefined, activas.slice(0, 10).map((o, i) => op(String(i + 1), o.obra.nombre)))],
    intencion: "elegir_obra",
    obraId: null,
  };
}

async function resolverPendiente(ctx: Ctx, p: typeof schema.conversacionPendientes.$inferSelect, texto: string, e: Entrada): Promise<Salida | null> {
  const t = normalizar(texto);
  const payload = p.payload as Record<string, unknown>;
  if (p.tipo === "elegir_obra") {
    const n = extraerNumeroLista(t);
    const activas = ctx.obras.filter((o) => o.obra.estado !== "finalizada");
    if (n && activas[n - 1]) {
      await limpiarPendientes(ctx.user.id, ctx.canal);
      const o = activas[n - 1];
      await fijarObraActiva(ctx, o.obra.id);
      const original = String(payload.texto ?? "");
      const medios = pendientesMedios.get(ctx.user.id) ?? [];
      pendientesMedios.delete(ctx.user.id);
      const c: CtxObra = { ...ctx, obraId: o.obra.id, obraNombre: o.obra.nombre, rol: o.rol, miembroId: o.miembroId ?? null };
      if (!original && !medios.length) return { respuestas: [r(`Listo, ahora hablamos de *${o.obra.nombre}*. ¿En qué te ayudo?`)], intencion: "elegir_obra", obraId: o.obra.id };
      const res = await manejar(c, original, medios);
      res.respuestas.unshift(r(`📍 Obra: *${o.obra.nombre}*`));
      return res;
    }
    return null;
  }
  const obraId = p.obraId!;
  const acceso = await rolEnObra(ctx.user.id, ctx.user.email, obraId);
  if (!acceso) { await limpiarPendientes(ctx.user.id, ctx.canal); return null; }
  const c: CtxObra = { ...ctx, obraId, obraNombre: acceso.obra.nombre, rol: acceso.rol, miembroId: acceso.miembroId };

  if (p.tipo === "confirmar") {
    if (esSi(t)) { await limpiarPendientes(ctx.user.id, ctx.canal); return { respuestas: [await ejecutarConfirmada(c, payload)], intencion: "accion_confirmada", obraId }; }
    if (esNo(t)) { await limpiarPendientes(ctx.user.id, ctx.canal); return { respuestas: [r("Listo, no hice nada.")], intencion: "accion_cancelada", obraId }; }
    const pct = payload.accion === "terminar_item" ? extraerPorcentaje(t) : null;
    if (pct != null) { await limpiarPendientes(ctx.user.id, ctx.canal); return { respuestas: [await fijarAvance(c, String(payload.id), pct, null)], intencion: "avance", obraId }; }
    return null;
  }
  if (p.tipo === "avance_pct") {
    const v = extraerPorcentaje(t) ?? (/(termin|complet|listo|100)/.test(t) ? 100 : null);
    if (v != null) {
      await limpiarPendientes(ctx.user.id, ctx.canal);
      return { respuestas: [await fijarAvance(c, String(payload.itemId), v, null)], intencion: "avance", obraId };
    }
    return null;
  }
  if (p.tipo === "elegir_item") {
    if (extraerPorcentaje(t) != null && !/^\d{1,2}$/.test(t)) return { respuestas: [r("Primero decime a qué tarea corresponde, respondiendo con el número de la lista. Después te pido el porcentaje.")], intencion: "aclaracion", obraId: p.obraId };
    const n = extraerNumeroLista(t);
    const ids = payload.itemIds as string[];
    if (n && ids[n - 1]) {
      await limpiarPendientes(ctx.user.id, ctx.canal);
      const it = await db.query.items.findFirst({ where: eq(schema.items.id, ids[n - 1]) });
      if (!it) return null;
      return { respuestas: await registrarAvanceTexto(c, it, String(payload.texto ?? ""), (payload.fotos as string[]) ?? [], payload.terminado as boolean), intencion: "avance", obraId };
    }
    return null;
  }
  void e;
  return null;
}

// ───────── Ruteo por intención ─────────
async function manejar(c: CtxObra, texto: string, medios: Medio[]): Promise<Salida> {
  const t = normalizar(texto);
  const out = (respuestas: Respuesta[], intencion: string): Salida => ({ respuestas, intencion, obraId: c.obraId });

  // Medios: se guardan siempre en la obra
  const fotos: string[] = [];
  const otros: string[] = [];
  const notasImagen: string[] = [];
  for (const m of medios) {
    if (m.tipo === "audio" && !m.transcripcion) {
      const ids = await guardarArchivos(c.obraId, c.user.id, [new File([new Uint8Array(m.buf)], m.nombre, { type: m.mime })], { categoria: "general", visibleCliente: false, visibleObrero: false });
      otros.push(...ids);
      continue;
    }
    const esImg = m.tipo === "image";
    const ids = await guardarArchivos(c.obraId, c.user.id, [new File([new Uint8Array(m.buf)], m.nombre, { type: m.mime })], {
      categoria: esImg ? "foto" : "general",
      visibleCliente: esImg && c.rol !== "cliente",
      visibleObrero: c.rol !== "cliente",
    });
    (esImg ? fotos : otros).push(...ids);
    if (esImg) {
      const d = await describirImagen(m.buf, m.mime, `${c.obraNombre}. Mensaje: ${texto}`);
      if (d) notasImagen.push(d);
    }
  }
  const audioSinTexto = medios.some((m) => m.tipo === "audio" && !m.transcripcion) && !texto;
  if (audioSinTexto) {
    await notificar(c.obraId, ["arquitecto"], `${c.user.nombre} envió un audio por WhatsApp (sin transcripción disponible)`, `/obras/${c.obraId}/documentos`, c.user.id);
    await espejar(c, "🎤 Audio recibido por WhatsApp", otros);
    return out([r("Recibí tu audio y se lo pasé al arquitecto. Si podés, contame en un mensaje corto lo principal así lo registro en la tarea que corresponde.")], "audio_sin_transcripcion");
  }

  // Ayuda
  if (!t && !fotos.length && !otros.length) return out([r(ayuda(c.rol, c.obraNombre))], "ayuda");
  if (/^(hola|buen(as|os)( dias| tardes| noches)?|ayuda|menu|que puedo (hacer|preguntar)|como funciona|gracias)\b/.test(t) && t.split(" ").length <= 4) {
    return out([r(/^gracias/.test(t) ? "¡De nada! 👷" : ayuda(c.rol, c.obraNombre))], "ayuda");
  }

  // Aprobar / rechazar por número (acción sensible → confirmación)
  const ap = t.match(/^(aprob\w*|rechaz\w*)\s+(?:el |la |n(?:ro|umero)?\.? ?)?(\d{1,2})$/);
  if (ap && c.rol !== "obrero") return out([await prepararAprobacion(c, ap[1].startsWith("aprob"), Number(ap[2]))], "accion_sensible");

  // ── Consultas (respuestas con datos reales, sin IA) ──
  const finanzas = c.rol === "arquitecto";
  if (/atrasad|retrasad|demorad|atraso|retraso/.test(t) && !/(no podemos|no vamos)/.test(t)) return out([await Q.atrasadas(c.obraId)], "consulta.atrasadas");
  if (finanzas && /(gast(amos|e|o|ado|os)|cuanto (llevamos|se) (gastad|invert))/.test(t) && !/queda/.test(t)) return out([await Q.gastos(c.obraId, t)], "consulta.gastos");
  if (finanzas && /(queda|resta|saldo|disponible).*(presupuesto|plata)|presupuesto.*(queda|resta|para)/.test(t)) return out([await Q.presupuestoRubro(c.obraId, t)], "consulta.presupuesto");
  if (c.rol !== "cliente" && /(que|cuales) materiales|materiales (necesit|hace|falt|para)|(comprar|pedir) (manana|para manana)|que (hay que|tenemos que) comprar/.test(t)) return out([await Q.materialesProximos(c.obraId)], "consulta.materiales");
  if (/pendiente|esperando (mi )?aprobacion|para aprobar|que (tengo|hay) que (aprobar|decidir)|decisiones/.test(t) && c.rol !== "obrero") {
    const { resp, lista } = await Q.pendientesAprobacion(c.obraId, c.rol);
    if (lista.length) await crearPendiente(c, c.obraId, "lista_aprobacion", { lista }, "Lista de aprobaciones", 60);
    return out([resp], "consulta.pendientes");
  }
  if (finanzas && /(cuant[ao]s|que) (personas|obreros|gente|trabajadores)|quien(es)? (vino|vinieron|trabaj)/.test(t)) return out([await Q.personalHoy(c.obraId)], "consulta.personal");
  if (/cuanto falta|cuando (termina|terminan|se termina|estaria|esta list|entregan)|fecha de (fin|entrega|finalizacion)/.test(t)) return out([await Q.cuantoFalta(c.obraId)], "consulta.fin");
  if (c.rol === "cliente" && /(cuanto|que) (tengo|hay|debo) que pagar|pagos? (de|del|este) mes|cuanto debo|cuanto pago/.test(t)) return out([await Q.pagosDelMes(c.obraId)], "consulta.pagos");
  if (/(mostra|mostrar|manda|mandar|pasa|pasar|ver|enviame|enviar).*(foto|como quedo|como esta|como va)|como quedo|fotos? de/.test(t) && !fotos.length) return out([await Q.fotosDe(c.obraId, t, c.rol)], "consulta.fotos");
  if (c.rol === "obrero" && /(que|cuales|mis) tareas|que (hago|hacemos|tengo que hacer|toca|sigue)/.test(t)) return out([await Q.tareasDelObrero(c.obraId, c.miembroId)], "consulta.tareas");
  if (/resumen|como (viene|va|anda|vamos)|estado de la obra|avance de la obra|novedades|como avanza/.test(t) && !fotos.length) return out([await Q.resumenAvance(c.obraId, c.rol)], "consulta.resumen");

  // ── Cliente: pedido de modificación → propuesta con impacto ──
  if (c.rol === "cliente" && /(quiero|quisiera|me gustaria|podemos|se puede|queria|quisieramos) (cambiar|modificar|agregar|sacar|reemplazar|poner|hacer)/.test(t)) {
    return out([await registrarCambio(c, texto)], "solicitud.cambio");
  }

  // ── Obrero / arquitecto: asistencia ──
  const asis = t.match(/(?:hoy )?(?:somos|estamos|vinimos|vino|trabajamos|trabajaron) (\d{1,2})(?: personas| obreros| tipos)?/);
  if (asis && c.rol !== "cliente") {
    await auditar(c.obraId, c.user.id, "asistencia", `${c.user.nombre}: ${asis[1]} personas (${hoyISO()})`);
    return out([r(`👍 Anoté ${asis[1]} personas trabajando hoy.`)], "observacion.asistencia");
  }

  if (c.rol !== "cliente") {
    const resumen = await resumenObra(c.obraId);
    const items = resumen.items;

    // Solicitud de materiales
    const mats = extraerMateriales(texto, resumen.insumos);
    if (mats.length && /(falta|faltan|necesit|precis|manda|mande|traer|pedir|pedi|no hay|se termino|nos quedamos sin|hace falta|hacen falta|quedan|comprar)/.test(t)) {
      return out([await crearSolicitudes(c, mats, texto, items, fotos)], "solicitud.material");
    }

    // Problema / imprevisto (no modifica fechas sin aprobación)
    if (/(no (podemos|pudimos|vamos a poder|se puede|llego|vino|hay como)|problema|se rompio|lluvia|llueve|llovio|frenad|parad[oa]s?|bloquead|autorizacion|accidente|filtracion|grieta|fisura|humedad|inconveniente|falla|imprevisto|no arranca)/.test(t)) {
      return out([await registrarProblema(c, texto, items, fotos, notasImagen)], "observacion.problema");
    }

    // Avance de obra (texto y/o fotos)
    const pctTxt = extraerPorcentaje(texto);
    const esAvance = /(termin|complet|listo|lista|avanz|hicimos|levantamos|colocamos|arrancamos|empezamos|comenzamos|vamos por|llevamos|quedo|quedaron|hormigon|colamos|llenamos|pusimos|revocamos|pintamos|instalamos)/.test(t) || pctTxt != null;
    if (esAvance || fotos.length) {
      const terminado = /(termin|complet|listo|lista)/.test(t) && !/(casi|falta|faltan|medio|parte)/.test(t);
      const cand = matchItems(texto, items, hoyISO());
      const enCurso = items.filter((i) => !i.esHito && i.avanceReal < 100 && i.inicio && i.inicio <= hoyISO()).sort((a, b) => (b.inicio ?? "").localeCompare(a.inicio ?? ""));
      let elegido: Item | undefined;
      if (cand.length === 1 || (cand.length > 1 && cand[0].score - cand[1].score >= 1)) elegido = cand[0].item;
      else if (!cand.length && fotos.length && enCurso.length === 1) elegido = enCurso[0];

      if (!elegido && (cand.length > 1 || (fotos.length && enCurso.length > 1)) ) {
        const opciones = (cand.length ? cand.map((x) => x.item) : enCurso).slice(0, 5);
        await crearPendiente(c, c.obraId, "elegir_item", { itemIds: opciones.map((i) => i.id), texto: [texto, ...notasImagen].filter(Boolean).join(" · "), fotos, terminado }, "Elegir tarea", 30);
        return out([r(`${fotos.length ? "📷 Guardé la foto. " : ""}¿A qué tarea corresponde?\n${opciones.map((i, k) => `${k + 1}. ${i.nombre} (${i.avanceReal.toFixed(0)}%)`).join("\n")}\n\nRespondé con el número.`, undefined, opciones.map((i, k) => op(String(k + 1), i.nombre)))], "aclaracion");
      }
      if (elegido) {
        const nota = [texto, ...notasImagen].filter(Boolean).join(" · ");
        if (pctTxt != null) return out([await fijarAvance(c, elegido.id, pctTxt, nota, fotos)], "avance");
        return out(await registrarAvanceTexto(c, elegido, nota, fotos, terminado), "avance");
      }
    }
  }

  // ── Sin regla clara: IA (si está disponible y hay cupo) ──
  if (aiDisponible() && (await cupoIA(c.obraId)).restante > 0 && t) {
    const interp = await interpretarConIA(c, texto);
    if (interp) {
      const res = await ejecutarInterpretacion(c, interp, texto, fotos, notasImagen);
      if (res) return out(res, `ia.${interp.intencion}`);
    }
    const libre = await responderLibre(c.obraId, c.user.id, c.rol, texto);
    if (libre) return out([r(libre)], "consulta.libre");
  }

  // ── Fallback: no se pierde nada ──
  if (fotos.length || otros.length) {
    await espejar(c, texto || "Archivos enviados por WhatsApp", [...fotos, ...otros]);
    await notificar(c.obraId, ["arquitecto"], `${c.user.nombre} envió ${fotos.length ? "fotos" : "archivos"} por WhatsApp`, `/obras/${c.obraId}/documentos`, c.user.id);
    return out([r(`📁 Guardé ${fotos.length + otros.length} archivo(s) en la obra *${c.obraNombre}* y le avisé al arquitecto.`)], "archivo");
  }
  if (c.rol !== "arquitecto" && t) {
    await espejar(c, texto, []);
    await notificar(c.obraId, ["arquitecto"], `${c.user.nombre} (WhatsApp): ${texto.slice(0, 90)}`, `/obras/${c.obraId}/mensajes?canal=${c.rol === "cliente" ? "cliente" : "obra"}`, c.user.id);
    return out([r(`No estoy seguro de haber entendido, así que le pasé tu mensaje al arquitecto.\n\n${ayudaCorta(c.rol)}`)], "no_interpretado");
  }
  return out([r(`No te entendí. ${ayudaCorta(c.rol)}`)], "no_interpretado");
}

// ───────── Acciones ─────────
/** Copia el mensaje al canal correspondiente de la web para que quede en el historial de la obra. */
async function espejar(c: CtxObra, texto: string, adjuntos: string[], tipo: "mensaje" | "cambio" | "observacion" | "sistema" = "mensaje") {
  if (c.canal !== "whatsapp" || c.rol === "arquitecto") return;
  await db.insert(schema.mensajes).values({ obraId: c.obraId, canal: c.rol === "cliente" ? "cliente" : "obra", autorId: c.user.id, tipo, texto, adjuntos, origen: "whatsapp" });
}

async function registrarAvanceTexto(c: CtxObra, it: Item, nota: string, fotos: string[], terminado: boolean): Promise<Respuesta[]> {
  // Se registra la observación con fotos; el % se confirma para no alterar datos por una mala interpretación
  await db.insert(schema.avances).values({ obraId: c.obraId, itemId: it.id, autorId: c.user.id, avancePct: it.avanceReal, nota: nota || null, tipo: "avance", fotos, origen: c.canal === "whatsapp" ? "whatsapp" : "web" });
  await espejar(c, `[${it.nombre}] ${nota}`, fotos, "observacion");
  if (terminado) {
    await crearPendiente(c, c.obraId, "confirmar", { accion: "terminar_item", id: it.id }, `Marcar ${it.nombre} terminada`, 60);
    return [r(`✅ Registré la novedad en *${it.nombre}*${fotos.length ? ` con ${fotos.length} foto(s)` : ""}.\n¿La marco como *terminada (100%)*? Respondé *SÍ* o *NO*.\nSi terminaron solo una parte, decime el porcentaje total (ej. "70%").`, undefined, [op("si", "Sí, terminada"), op("no", "No"), op("50%", "Va por la mitad")])];
  }
  await crearPendiente(c, c.obraId, "avance_pct", { itemId: it.id }, `Porcentaje de ${it.nombre}`, 60);
  return [r(`📝 Registré la novedad en *${it.nombre}*${fotos.length ? ` con ${fotos.length} foto(s)` : ""} (hoy figura en ${it.avanceReal.toFixed(0)}%).\n¿Qué porcentaje total lleva la tarea? Respondé con un número, por ejemplo "60%".`, undefined, ["25%", "50%", "75%", "100%"].map((v) => op(v)))];
}

async function fijarAvance(c: CtxObra, itemId: string, pct: number, nota: string | null, fotos: string[] = []): Promise<Respuesta> {
  const it = await db.query.items.findFirst({ where: and(eq(schema.items.id, itemId), eq(schema.items.obraId, c.obraId)) });
  if (!it) return r("No encontré esa tarea.");
  if (c.rol === "cliente") return r("Tu perfil no puede registrar avances.");
  await db.update(schema.items).set({ avanceReal: pct }).where(eq(schema.items.id, itemId));
  if (nota || fotos.length) await db.insert(schema.avances).values({ obraId: c.obraId, itemId, autorId: c.user.id, avancePct: pct, nota, fotos, origen: c.canal === "whatsapp" ? "whatsapp" : "web" });
  else await db.insert(schema.avances).values({ obraId: c.obraId, itemId, autorId: c.user.id, avancePct: pct, nota: `Avance informado por ${c.canal}`, origen: c.canal === "whatsapp" ? "whatsapp" : "web" });
  await auditar(c.obraId, c.user.id, `avance.${c.canal}`, `${it.nombre} ${it.avanceReal}% → ${pct}%`);
  await notificar(c.obraId, ["arquitecto", "cliente"], `${c.user.nombre} informó ${pct}% de avance en "${it.nombre}"`, `/obras/${c.obraId}/seguimiento`, c.user.id, { whatsapp: false });
  return r(`👍 *${it.nombre}* quedó en ${pct}%. ${pct >= 100 ? "¡Tarea terminada!" : ""}`.trim());
}

async function crearSolicitudes(c: CtxObra, mats: ReturnType<typeof extraerMateriales>, texto: string, items: Item[], fotos: string[]): Promise<Respuesta> {
  const t = normalizar(texto);
  const cand = matchItems(texto, items, hoyISO());
  const fecha = /manana/.test(t) ? (await import("../engine/calendario")).sumarHabiles(hoyISO(), 1) : null;
  const prioridad = /urgente|ya mismo|hoy|parad|no podemos/.test(t) ? "urgente" : /manana/.test(t) ? "alta" : "media";
  const L: string[] = [];
  for (const m of mats) {
    // ¿corresponde a la obra? se valida contra el cómputo
    const enComputo = m.insumo ? "✔ figura en el cómputo" : "⚠ no figura en el cómputo de la obra";
    await db.insert(schema.solicitudes).values({
      obraId: c.obraId, solicitanteId: c.user.id, material: m.material, insumoId: m.insumo?.id ?? null, cantidad: m.cantidad, unidad: m.unidad,
      fechaNecesaria: fecha, itemId: cand[0]?.item.id ?? null, observaciones: texto.slice(0, 500), prioridad, fotos, origen: c.canal === "whatsapp" ? "whatsapp" : "asistente",
    });
    L.push(`• ${num(m.cantidad)} ${m.unidad} de ${m.material} (${enComputo})`);
  }
  await notificar(c.obraId, ["arquitecto"], `${c.user.nombre} pidió por ${c.canal === "whatsapp" ? "WhatsApp" : "el asistente"}: ${mats.map((m) => `${m.cantidad} ${m.unidad} ${m.material}`).join(", ")}${prioridad === "urgente" ? " (URGENTE)" : ""}`, `/obras/${c.obraId}/solicitudes`, c.user.id);
  await auditar(c.obraId, c.user.id, `solicitud.${c.canal}`, texto.slice(0, 200));
  await espejar(c, texto, fotos);
  return r(`📦 Listo, cargué el pedido${fecha ? " para mañana" : ""}:\n${L.join("\n")}${cand[0] ? `\nTarea: ${cand[0].item.nombre}` : ""}\nPrioridad: ${prioridad}. Ya le avisé al arquitecto; te confirmo cuando lo apruebe.`);
}

async function registrarProblema(c: CtxObra, texto: string, items: Item[], fotos: string[], notasImagen: string[]): Promise<Respuesta> {
  const cand = matchItems(texto, items, hoyISO());
  const enCurso = items.filter((i) => !i.esHito && i.avanceReal < 100 && i.inicio && i.inicio <= hoyISO() && (i.fin ?? "") >= hoyISO());
  const it = cand[0]?.item ?? enCurso[0];
  const nota = [texto, ...notasImagen].join(" · ");
  if (it) await db.insert(schema.avances).values({ obraId: c.obraId, itemId: it.id, autorId: c.user.id, avancePct: it.avanceReal, nota, tipo: "problema", fotos, origen: c.canal === "whatsapp" ? "whatsapp" : "web" });
  await espejar(c, `⚠ ${texto}`, fotos, "observacion");
  await notificar(c.obraId, ["arquitecto"], `⚠ ${c.user.nombre} informó un problema${it ? ` en "${it.nombre}"` : ""}: ${texto.slice(0, 120)}`, `/obras/${c.obraId}/seguimiento`, c.user.id);
  await auditar(c.obraId, c.user.id, `problema.${c.canal}`, texto.slice(0, 200));
  return r(`⚠ Registré el problema${it ? ` en *${it.nombre}*` : ""} y le avisé al arquitecto.\nEl cronograma no se modifica hasta que él lo revise y lo apruebe.`);
}

async function registrarCambio(c: CtxObra, texto: string): Promise<Respuesta> {
  const res = await resumenObra(c.obraId);
  const todos = matchItems(texto, res.items, hoyISO());
  const cand = todos.filter((x) => x.score >= (todos[0]?.score ?? 0) * 0.75).slice(0, 3).map((x) => x.item);
  const coef = res.presupuesto.coeficienteResumen;
  const parcial = new Map(res.presupuesto.rubros.flatMap((fr) => fr.items.map((x) => [x.item.id, x.parcial * coef] as const)));
  const costo = cand.reduce((a, i) => a + (parcial.get(i.id) ?? 0), 0);
  await db.insert(schema.cambios).values({ obraId: c.obraId, solicitanteId: c.user.id, descripcion: texto, itemsAfectados: cand.map((i) => i.id), costoAfectado: costo || null, origen: c.canal === "whatsapp" ? "whatsapp" : "web" });
  await db.insert(schema.mensajes).values({ obraId: c.obraId, canal: "cliente", autorId: c.user.id, tipo: "cambio", texto, origen: c.canal === "whatsapp" ? "whatsapp" : "web" });
  await notificar(c.obraId, ["arquitecto"], `El cliente pidió un cambio: ${texto.slice(0, 100)}. Evaluá costo y plazo.`, `/obras/${c.obraId}/presupuesto#cambios`, c.user.id);
  await auditar(c.obraId, c.user.id, `cambio.solicitar.${c.canal}`, texto.slice(0, 200));
  return r(
    `📝 Registré tu pedido de cambio.\n` +
      (cand.length ? `Afecta a: ${cand.map((i) => i.nombre).join(", ")}${costo && !res.presupuesto.faltanPrecios ? ` (hoy presupuestado en ${ars(costo)})` : ""}.\n` : "") +
      `El arquitecto va a evaluar el impacto en *costo y plazo* y te va a llegar la propuesta para que la apruebes. No se ejecuta nada hasta que vos la aceptes.`,
  );
}

async function prepararAprobacion(c: CtxObra, aprobar: boolean, n: number): Promise<Respuesta> {
  const p = await pendienteActual(c.user.id, c.canal);
  let lista = (p?.tipo === "lista_aprobacion" ? (p.payload.lista as Q.PendienteAprobacion[]) : null) ?? (await Q.pendientesAprobacion(c.obraId, c.rol)).lista;
  const el = lista[n - 1];
  if (!el) return r("No encontré ese número. Preguntame \"¿qué tengo pendiente?\" para ver la lista.");
  if (el.tipo === "cambio") return r("Los cambios pedidos por el cliente se evalúan desde la web (Presupuesto → Cambios), porque hay que cargar costo y plazo.");
  const accion = `${aprobar ? "aprobar" : "rechazar"}_${el.tipo}`;
  await crearPendiente(c, c.obraId, "confirmar", { accion, id: el.id }, `${aprobar ? "Aprobar" : "Rechazar"}: ${el.texto}`, 30);
  return r(`¿Confirmás que querés *${aprobar ? "APROBAR" : "RECHAZAR"}* esto?\n${el.texto}\n\nRespondé *SÍ* para confirmar o *NO* para cancelar.`, undefined, SI_NO);
}

/** Ejecuta una acción sensible ya confirmada. Revalida permisos al momento de ejecutar. */
async function ejecutarConfirmada(c: CtxObra, payload: Record<string, unknown>): Promise<Respuesta> {
  const accion = String(payload.accion);
  const id = String(payload.id);
  const via = c.canal === "whatsapp" ? "WhatsApp" : "asistente";
  if (accion === "terminar_item") {
    if (c.rol === "cliente") return r("Sin permiso.");
    return fijarAvance(c, id, 100, `Terminada (confirmado por ${via})`);
  }
  if (accion === "aprobar_solicitud" || accion === "rechazar_solicitud") {
    if (c.rol !== "arquitecto") return r("Solo el arquitecto puede aprobar solicitudes.");
    const s = await db.query.solicitudes.findFirst({ where: and(eq(schema.solicitudes.id, id), eq(schema.solicitudes.obraId, c.obraId)) });
    if (!s || s.estado !== "pendiente") return r("Esa solicitud ya no está pendiente.");
    const estado = accion.startsWith("aprobar") ? "aprobada" : "rechazada";
    await db.update(schema.solicitudes).set({ estado, respuesta: `${estado === "aprobada" ? "Aprobada" : "Rechazada"} por ${via}` }).where(eq(schema.solicitudes.id, id));
    await db.insert(schema.notificaciones).values({ userId: s.solicitanteId, obraId: c.obraId, texto: `Tu pedido de ${s.cantidad} ${s.unidad} de ${s.material} fue ${estado}`, link: `/obras/${c.obraId}/solicitudes` });
    const { notificarPorWhatsApp } = await import("../whatsapp/enviar");
    await notificarPorWhatsApp([s.solicitanteId], c.obraId, `Tu pedido de ${num(s.cantidad)} ${s.unidad} de ${s.material} fue *${estado}* por el arquitecto.`);
    await auditar(c.obraId, c.user.id, `solicitud.${estado}`, `${s.material} (vía ${via})`);
    return r(`✅ Solicitud ${estado}: ${num(s.cantidad)} ${s.unidad} de ${s.material}. Le avisé a quien la pidió.${estado === "aprobada" ? "\nPodés pedir cotizaciones o registrar la compra desde la web." : ""}`);
  }
  if (accion === "aprobar_adicional" || accion === "rechazar_adicional") {
    if (c.rol !== "cliente") return r("Los adicionales los aprueba el cliente.");
    const a = await db.query.adicionales.findFirst({ where: and(eq(schema.adicionales.id, id), eq(schema.adicionales.obraId, c.obraId)) });
    if (!a || a.estado !== "pendiente") return r("Ese adicional ya fue respondido.");
    const estado = accion.startsWith("aprobar") ? "aprobado" : "rechazado";
    await db.update(schema.adicionales).set({ estado, respuestaCliente: `Respondido por ${via}` }).where(eq(schema.adicionales.id, id));
    await db.update(schema.cambios).set({ estado: estado === "aprobado" ? "aprobado" : "rechazado" }).where(eq(schema.cambios.adicionalId, id));
    await db.insert(schema.mensajes).values({ obraId: c.obraId, canal: "cliente", autorId: c.user.id, tipo: "decision", texto: `${estado === "aprobado" ? "Aprobé" : "Rechacé"} el adicional "${a.titulo}" (${ars(a.monto)})`, origen: c.canal === "whatsapp" ? "whatsapp" : "web" });
    await notificar(c.obraId, ["arquitecto"], `El cliente ${estado === "aprobado" ? "aprobó" : "rechazó"} el adicional "${a.titulo}"`, `/obras/${c.obraId}/presupuesto`, c.user.id);
    await auditar(c.obraId, c.user.id, `adicional.${estado}`, `${a.titulo} (vía ${via})`);
    return r(`✅ Adicional "${a.titulo}" ${estado}. Quedó registrado como decisión en la obra.`);
  }
  if (accion === "aprobar_compra" || accion === "rechazar_compra") {
    if (c.rol !== "cliente") return r("Sin permiso.");
    const co = await db.query.compras.findFirst({ where: and(eq(schema.compras.id, id), eq(schema.compras.obraId, c.obraId)) });
    if (!co || co.aprobacionCliente !== "pendiente") return r("Esa compra ya fue respondida.");
    const ok = accion.startsWith("aprobar");
    await db.update(schema.compras).set({ aprobacionCliente: ok ? "aprobada" : "rechazada", estado: ok ? "pedida" : "prevista" }).where(eq(schema.compras.id, id));
    await notificar(c.obraId, ["arquitecto"], `El cliente ${ok ? "aprobó" : "rechazó"} la compra "${co.descripcion}"`, `/obras/${c.obraId}/compras`, c.user.id);
    await auditar(c.obraId, c.user.id, ok ? "compra.aprobar" : "compra.rechazar", `${co.descripcion} (vía ${via})`);
    return r(`✅ Compra ${ok ? "aprobada" : "rechazada"}: ${co.descripcion} (${ars(co.total)}).`);
  }
  return r("No reconozco esa acción.");
}

async function ejecutarInterpretacion(c: CtxObra, i: Interpretacion, texto: string, fotos: string[], notas: string[]): Promise<Respuesta[] | null> {
  const res = await resumenObra(c.obraId);
  const item = i.tarea ? res.items.find((x) => normalizar(x.nombre) === normalizar(i.tarea!)) ?? matchItems(i.tarea, res.items, hoyISO())[0]?.item : undefined;
  switch (i.intencion) {
    case "consulta":
      return null; // la responde responderLibre con el contexto de la obra
    case "solicitud_material":
      if (c.rol === "cliente" || !i.materiales?.length) return null;
      return [await crearSolicitudes(c, i.materiales.map((m) => ({ ...m, insumo: res.insumos.find((x) => normalizar(x.nombre) === normalizar(m.material)) })), texto, res.items, fotos)];
    case "problema":
      if (c.rol === "cliente") return null;
      return [await registrarProblema(c, texto, res.items, fotos, notas)];
    case "avance":
      if (c.rol === "cliente" || !item) return null;
      if (i.avancePct != null) return [await fijarAvance(c, item.id, i.avancePct, [texto, ...notas].join(" · "), fotos)];
      return registrarAvanceTexto(c, item, [texto, ...notas].join(" · "), fotos, !!i.terminado);
    case "cambio":
      if (c.rol !== "cliente") return null;
      return [await registrarCambio(c, texto)];
    case "aclaracion":
      return i.pregunta ? [r(i.pregunta)] : null;
    default:
      return null;
  }
}

// ───────── Textos de ayuda ─────────
function ayuda(rol: Rol, obra: string): string {
  const base = `👷 Asistente de la obra *${obra}*.\n`;
  if (rol === "obrero")
    return base + "Podés escribirme o mandarme audios y fotos como a una persona. Por ejemplo:\n• \"Hoy terminamos de levantar las paredes del dormitorio\"\n• \"Nos faltan 20 bolsas de cemento para mañana\"\n• \"No podemos seguir porque no llegó el material\"\n• \"Hoy somos 4\"\n• \"¿Qué tareas tengo?\"\nPara cambiar de obra escribí *obras*.";
  if (rol === "cliente")
    return base + "Podés preguntarme:\n• \"¿Cómo viene avanzando mi casa?\"\n• \"¿Cuánto falta para terminar?\"\n• \"¿Qué decisiones tengo pendientes?\"\n• \"¿Cuánto tengo que pagar este mes?\"\n• \"Mostrame cómo quedó el baño\"\n• \"Quiero cambiar el revestimiento de la cocina\"";
  return base + "Probá con:\n• \"¿Qué tareas están atrasadas?\"\n• \"¿Cuánto gastamos esta semana?\"\n• \"¿Qué materiales necesitamos mañana?\"\n• \"¿Cuánto queda de presupuesto para instalaciones?\"\n• \"¿Qué pedidos esperan mi aprobación?\" → \"aprobar 1\"\n• \"Generame un informe semanal\"\n• \"obras\" para cambiar de obra";
}
const ayudaCorta = (rol: Rol) => (rol === "obrero" ? "Podés contarme avances, pedir materiales o avisar problemas. Escribí *ayuda* para ver ejemplos." : rol === "cliente" ? "Podés preguntarme cómo viene la obra, cuánto falta o qué tenés pendiente. Escribí *ayuda* para ver ejemplos." : "Escribí *ayuda* para ver ejemplos de consultas.");
