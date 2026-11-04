import Link from "next/link";
import { asc, eq, inArray, or } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { obrasDelUsuario } from "@/lib/queries";
import { Badge, Field, PageHeader, Section } from "@/components/ui";
import { ActionForm } from "@/components/forms/form-state";
import { ActionButton, ConfirmAction } from "@/components/client";
import { bloquearContactoWA, cambiarNotificacionesWA, reenviarBienvenidaWA, simularMensaje, vincularPorWhatsApp } from "@/app/actions/whatsapp";
import { checklistActivacion, simuladorHabilitado, waActivo, waConfig } from "@/lib/whatsapp/config";
import { telefonoLegible } from "@/lib/whatsapp/telefono";
import { ventanaAbierta } from "@/lib/whatsapp/enviar";
import { ROL_LABEL, fechaHora } from "@/lib/format";
import { OpcionesWA, SimuladorInput } from "./simulador";
import { AutoRefresh, ScrollAbajo } from "@/app/(obra)/obras/[id]/mensajes/chat-client";

const EJEMPLOS = {
  obrero: ["Hola", "Hoy terminamos de levantar las paredes del dormitorio", "Nos faltan 20 bolsas de cemento para mañana", "No podemos continuar porque todavía no llegó el material", "Terminamos el hormigonado", "Hoy somos 4", "¿Qué tareas tengo?"],
  cliente: ["¿Cómo viene avanzando mi casa?", "¿Cuánto falta para terminar?", "¿Qué decisiones tengo pendientes?", "¿Cuánto tengo que pagar este mes?", "¿Me pueden mostrar cómo quedó el baño?", "Quiero cambiar el revestimiento de la cocina"],
  arquitecto: ["¿Qué tareas están atrasadas en la obra?", "¿Cuánto gastamos esta semana?", "¿Qué materiales necesitamos comprar mañana?", "Mandame un resumen del avance de la obra", "¿Cuánto nos queda de presupuesto para instalaciones?", "¿Qué pedidos están esperando mi aprobación?", "¿Cuántas personas trabajaron hoy?", "Generame un informe semanal de todas mis obras"],
} as const;

export default async function WhatsAppPage({ searchParams }: { searchParams: Promise<{ c?: string }> }) {
  const { c: sel } = await searchParams;
  const user = await requireUser();
  const obras = await obrasDelUsuario(user);
  const mias = obras.filter((o) => o.rol === "arquitecto");
  const miembros = mias.length ? await db.query.miembros.findMany({ where: inArray(schema.miembros.obraId, mias.map((o) => o.obra.id)) }) : [];
  const userIds = [...new Set([user.id, ...miembros.map((m) => m.userId).filter(Boolean) as string[]])];
  const contactos = await db.query.waContactos.findMany({ where: or(inArray(schema.waContactos.userId, userIds), eq(schema.waContactos.invitadoPor, user.id)) });
  const usuarios = await db.query.users.findMany({ where: inArray(schema.users.id, userIds) });
  const activo = waActivo();
  const sim = simuladorHabilitado();
  const elegido = contactos.find((c) => c.id === sel) ?? contactos.find((c) => c.userId !== user.id) ?? contactos[0];
  const conversacion = elegido ? await db.query.waMensajes.findMany({ where: eq(schema.waMensajes.contactoId, elegido.id), orderBy: asc(schema.waMensajes.createdAt), limit: 200 }) : [];
  const rolDe = (uid: string | null) => {
    if (uid === user.id) return "arquitecto" as const;
    const ms = miembros.filter((m) => m.userId === uid);
    return (ms[0]?.rol ?? "obrero") as keyof typeof EJEMPLOS;
  };
  const obrasDe = (uid: string | null) => (uid === user.id ? mias.map((o) => o.obra.nombre) : miembros.filter((m) => m.userId === uid).map((m) => mias.find((o) => o.obra.id === m.obraId)?.obra.nombre));
  const docIds = conversacion.map((m) => m.mediaDocId).filter(Boolean) as string[];

  return (
    <>
      <PageHeader title="WhatsApp" subtitle="Clientes, obreros y vos pueden usar la plataforma desde WhatsApp, sin descargar nada. Todo lo que pasa por WhatsApp se guarda en la misma obra, con historial." />
      <AutoRefresh ms={20000} />
      <div className="grid gap-6 xl:grid-cols-5">
        <div className="space-y-6 xl:col-span-2">
          <div className={`card card-pad ${activo ? "border-brand-500" : "border-amber-300"}`}>
            <div className="flex items-center justify-between">
              <div className="h2">Estado del canal</div>
              {activo ? <Badge tono="verde">Conectado a WhatsApp Cloud API</Badge> : <Badge tono="ambar">PENDIENTE · WhatsApp real no conectado</Badge>}
            </div>
            <p className="muted mt-2">
              {activo
                ? <>Webhook: <code className="rounded bg-zinc-100 px-1 text-xs">{waConfig().appUrl}/api/whatsapp/webhook</code></>
                : "WhatsApp todavía NO está conectado: ningún mensaje sale a teléfonos reales. Mientras tanto podés probar las conversaciones con el simulador de la derecha, que usa los datos reales de la obra. Para activarlo hace falta:"}
            </p>
            {!activo && (
              <ul className="mt-3 space-y-1.5 text-xs">
                {checklistActivacion().map((x) => (
                  <li key={x.clave} className="flex gap-2"><span>{x.ok ? "✅" : "⬜"}</span><span><b>{x.clave}</b> — <span className="text-zinc-500">{x.ayuda}</span></span></li>
                ))}
              </ul>
            )}
          </div>

          {mias.length > 0 && (
            <div className="card card-pad">
              <div className="h2 mb-1">Sumar a alguien por WhatsApp</div>
              <p className="muted mb-3">No necesita registrarse: con su número ya queda vinculado a la obra con su perfil y permisos.</p>
              <ActionForm action={vincularPorWhatsApp} resetOnOk submitLabel="Vincular y enviar bienvenida">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Obra"><select name="obraId" className="input">{mias.map((o) => <option key={o.obra.id} value={o.obra.id}>{o.obra.nombre}</option>)}</select></Field>
                  <Field label="Perfil"><select name="rol" className="input" defaultValue="obrero"><option value="obrero">Obrero / encargado</option><option value="cliente">Cliente</option><option value="arquitecto">Arquitecto colaborador</option></select></Field>
                  <Field label="Nombre *"><input name="nombre" className="input" required /></Field>
                  <Field label="WhatsApp *"><input name="telefono" className="input" required placeholder="11 5555 4444" inputMode="tel" /></Field>
                  <Field label="Oficio"><input name="oficio" className="input" placeholder="Capataz, plomero…" /></Field>
                  <Field label="Email (opcional)"><input name="email" type="email" className="input" /></Field>
                </div>
              </ActionForm>
            </div>
          )}

          <Section title={`Números vinculados (${contactos.length})`}>
            <ul className="divide-y divide-zinc-100">
              {contactos.length === 0 && <li className="muted p-5">Todavía no hay números. Sumá a alguien o vinculá tu propio número desde Configuración.</li>}
              {contactos.map((c) => {
                const u = usuarios.find((x) => x.id === c.userId);
                const rol = rolDe(c.userId);
                return (
                  <li key={c.id} className={`px-5 py-3 ${elegido?.id === c.id ? "bg-zinc-50" : ""}`}>
                    <div className="flex items-start justify-between gap-2">
                      <Link href={`?c=${c.id}`} className="min-w-0">
                        <div className="truncate text-sm font-medium hover:underline">{u?.nombre ?? c.nombre ?? "Sin vincular"}{c.userId === user.id && " (vos)"}</div>
                        <div className="text-xs text-zinc-500">{telefonoLegible(c.telefono)} · {ROL_LABEL[rol]} · {obrasDe(c.userId).filter(Boolean).join(", ")}</div>
                      </Link>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <Badge tono={c.estado === "activo" ? "verde" : c.estado === "bloqueado" ? "rojo" : "ambar"}>{c.estado}</Badge>
                        {c.estado === "activo" && <span className="text-[10px] text-zinc-400">{ventanaAbierta(c) ? "ventana 24 h abierta" : "fuera de ventana: usa plantilla"}</span>}
                      </div>
                    </div>
                    {c.userId !== user.id && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <ActionButton action={cambiarNotificacionesWA.bind(null, c.id, !c.notificaciones)} className="btn-ghost btn-sm">{c.notificaciones ? "🔔 Avisos activados" : "🔕 Avisos desactivados"}</ActionButton>
                        {c.estado === "invitado" && mias[0] && <ActionButton action={reenviarBienvenidaWA.bind(null, c.id, miembros.find((m) => m.userId === c.userId)?.obraId ?? mias[0].obra.id)} className="btn-ghost btn-sm">Reenviar bienvenida</ActionButton>}
                        <ConfirmAction action={bloquearContactoWA.bind(null, c.id, c.estado !== "bloqueado")} label={c.estado === "bloqueado" ? "Desbloquear" : "Bloquear"} className="btn-ghost btn-sm text-zinc-500" title={c.estado === "bloqueado" ? "¿Desbloquear número?" : "¿Bloquear este número?"} message="Un número bloqueado no puede consultar ni registrar nada por WhatsApp." />
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </Section>
        </div>

        <div className="xl:col-span-3">
          {elegido ? (
            <div className="card flex h-[78vh] flex-col overflow-hidden">
              <div className="flex items-center gap-3 bg-[#008069] px-4 py-3 text-white">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20 text-sm font-semibold">{(usuarios.find((x) => x.id === elegido.userId)?.nombre ?? "?").slice(0, 1)}</div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{usuarios.find((x) => x.id === elegido.userId)?.nombre ?? elegido.nombre} ↔ Obrapp</div>
                  <div className="text-xs text-white/70">{telefonoLegible(elegido.telefono)} · {sim ? "SIMULADOR · no se envía a WhatsApp real · escribís como esta persona" : "historial de la conversación"}</div>
                </div>
              </div>
              <div className="flex-1 space-y-2 overflow-y-auto bg-[#efeae2] p-4">
                {conversacion.length === 0 && <p className="py-10 text-center text-sm text-zinc-500">Sin mensajes todavía.</p>}
                {conversacion.map((m, idx) => {
                  const sale = m.direccion === "saliente";
                  const ultimo = idx === conversacion.length - 1;
                  return (
                    <div key={m.id} className={`flex ${sale ? "justify-start" : "justify-end"}`}>
                      <div className={`max-w-[85%] rounded-lg px-3 py-1.5 text-sm shadow-sm ${sale ? "bg-white" : "bg-[#d9fdd3]"}`}>
                        {m.tipo === "template" && <div className="mb-1 text-[10px] font-medium uppercase text-zinc-400">Plantilla</div>}
                        {m.mediaDocId && docIds.includes(m.mediaDocId) && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <a href={`/api/archivos/${m.mediaDocId}`} target="_blank"><img src={`/api/archivos/${m.mediaDocId}`} alt="" className="mb-1 max-h-56 rounded" /></a>
                        )}
                        {!sale && m.tipo !== "text" && <div className="text-xs text-zinc-500">{m.tipo === "image" ? "📷 Foto" : m.tipo === "audio" ? "🎤 Audio" : m.tipo === "document" ? "📄 Documento" : m.tipo === "video" ? "🎬 Video" : ""}</div>}
                        {m.texto && <div className="whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: formatoWA(m.texto) }} />}
                        {m.transcripcion && <div className="mt-1 text-xs italic text-zinc-500">Transcripción: {m.transcripcion}</div>}
                        {sale && m.opciones?.length ? (ultimo && sim ? <OpcionesWA action={simularMensaje.bind(null, elegido.id)} opciones={m.opciones} /> : <div className="mt-1 text-[11px] text-zinc-400">Opciones: {m.opciones.map((o) => o.titulo).join(" · ")}</div>) : null}
                        <div className="mt-0.5 flex justify-end gap-1.5 text-[10px] text-zinc-400">
                          {m.intencion && !sale && <span className="rounded bg-black/5 px-1">{m.intencion}</span>}
                          {m.estado === "error" && <span className="text-red-500" title={m.error ?? ""}>error</span>}
                          <span>{fechaHora(m.createdAt)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
                <ScrollAbajo />
              </div>
              {sim ? (
                <SimuladorInput action={simularMensaje.bind(null, elegido.id)} ejemplos={[...EJEMPLOS[rolDe(elegido.userId)]]} />
              ) : (
                <div className="border-t border-zinc-200 p-3 text-center text-xs text-zinc-500">Las conversaciones reales se ven acá. El simulador está apagado en producción.</div>
              )}
            </div>
          ) : (
            <div className="card card-pad muted">Vinculá un número para ver o simular conversaciones.</div>
          )}
        </div>
      </div>
    </>
  );
}

function formatoWA(t: string) {
  return t
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/\*([^*\n]+)\*/g, "<b>$1</b>")
    .replace(/(^|\s)_([^_\n]+)_/g, "$1<i>$2</i>")
    .replace(/(https?:\/\/[^\s]+)/g, '<a class="text-sky-700 underline" href="$1">$1</a>');
}
