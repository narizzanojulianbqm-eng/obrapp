import Link from "next/link";
import { and, asc, eq, inArray } from "drizzle-orm";
import { requireObra } from "@/lib/access";
import { db, schema } from "@/lib/db";
import { CANALES, puedeCanal } from "@/lib/canales";
import { enviarMensaje } from "@/app/actions/comunicacion";
import { PageHeader, Badge } from "@/components/ui";
import { fechaHora, ROL_LABEL } from "@/lib/format";
import { AutoRefresh, Composer, ScrollAbajo } from "./chat-client";

const TIPO = { decision: { l: "Decisión", t: "verde" }, cambio: { l: "Solicitud de cambio", t: "ambar" }, observacion: { l: "Observación", t: "azul" }, sistema: { l: "Sistema", t: "gris" } } as const;

export default async function Mensajes({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ canal?: string }> }) {
  const { id } = await params;
  const { canal: c } = await searchParams;
  const { user, rol, obra } = await requireObra(id);
  const canales = Object.entries(CANALES).filter(([, v]) => v.roles.includes(rol));
  const canal = c && puedeCanal(rol, c) ? c : canales[rol === "arquitecto" ? 0 : 1]?.[0] ?? "general";
  const msgs = await db.query.mensajes.findMany({ where: and(eq(schema.mensajes.obraId, id), eq(schema.mensajes.canal, canal)), orderBy: asc(schema.mensajes.createdAt), limit: 300 });
  const autores = msgs.length ? await db.query.users.findMany({ where: inArray(schema.users.id, [...new Set(msgs.map((m) => m.autorId))]) }) : [];
  const miembros = await db.query.miembros.findMany({ where: eq(schema.miembros.obraId, id) });
  const rolDe = (uid: string) => (uid === obra.ownerId ? "arquitecto" : miembros.find((m) => m.userId === uid)?.rol ?? "arquitecto");
  const adjIds = msgs.flatMap((m) => m.adjuntos);
  const docs = adjIds.length ? await db.query.documentos.findMany({ where: inArray(schema.documentos.id, adjIds) }) : [];
  const decisiones = await db.query.mensajes.findMany({ where: and(eq(schema.mensajes.obraId, id), eq(schema.mensajes.tipo, "decision")), orderBy: asc(schema.mensajes.createdAt) });
  const decisionesVisibles = decisiones.filter((d) => puedeCanal(rol, d.canal));

  return (
    <>
      <PageHeader title="Comunicación" subtitle="Todo lo que se conversa queda vinculado a la obra, con historial, adjuntos y decisiones registradas. Los mensajes por WhatsApp también aparecen acá." />
      <AutoRefresh />
      <div className="grid gap-6 lg:grid-cols-4">
        <div className="space-y-1">
          {canales.map(([k, v]) => (
            <Link key={k} href={`?canal=${k}`} className={`block rounded-lg px-3 py-2 ${canal === k ? "bg-zinc-900 text-white" : "hover:bg-zinc-100"}`}>
              <div className="text-sm font-medium">{v.nombre}</div>
              <div className={`text-xs ${canal === k ? "text-zinc-300" : "text-zinc-500"}`}>{v.descripcion}</div>
            </Link>
          ))}
          {decisionesVisibles.length > 0 && (
            <div className="card mt-4 p-3">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">Registro de decisiones</div>
              <ul className="space-y-2 text-xs">{decisionesVisibles.slice(-8).map((d) => <li key={d.id}><span className="text-zinc-400">{fechaHora(d.createdAt)}</span><br />{d.texto}</li>)}</ul>
            </div>
          )}
        </div>
        <div className="card flex h-[70vh] flex-col lg:col-span-3">
          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            {msgs.length === 0 && <p className="muted py-10 text-center">Todavía no hay mensajes en esta conversación.</p>}
            {msgs.map((m) => {
              const mio = m.autorId === user.id;
              const autor = autores.find((a) => a.id === m.autorId);
              const t = m.tipo !== "mensaje" ? TIPO[m.tipo as keyof typeof TIPO] : null;
              return (
                <div key={m.id} className={`flex ${mio ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm ${mio ? "bg-brand-700 text-white" : "bg-zinc-100 text-zinc-900"}`}>
                    {!mio && <div className="mb-0.5 text-xs font-medium opacity-70">{autor?.nombre} · {ROL_LABEL[rolDe(m.autorId) as keyof typeof ROL_LABEL]}</div>}
                    {t && <div className="mb-1"><Badge tono={t.t}>{t.l}</Badge></div>}
                    <div className="whitespace-pre-wrap">{m.texto}</div>
                    {m.adjuntos.map((a) => {
                      const d = docs.find((x) => x.id === a);
                      if (!d) return null;
                      return d.mime?.startsWith("image/") ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <a key={a} href={`/api/archivos/${a}`} target="_blank"><img src={`/api/archivos/${a}`} alt={d.nombre} className="mt-2 max-h-48 rounded-lg" /></a>
                      ) : (
                        <a key={a} href={`/api/archivos/${a}`} target="_blank" className="mt-1 block underline">📎 {d.nombre}</a>
                      );
                    })}
                    <div className={`mt-1 text-[10px] ${mio ? "text-white/60" : "text-zinc-400"}`}>{fechaHora(m.createdAt)}{m.origen === "whatsapp" && " · vía WhatsApp"}</div>
                  </div>
                </div>
              );
            })}
            <ScrollAbajo />
          </div>
          <Composer action={enviarMensaje.bind(null, id, canal)} puedeDecision={rol !== "obrero"} />
        </div>
      </div>
    </>
  );
}
