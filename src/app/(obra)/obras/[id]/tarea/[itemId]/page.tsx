import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { requireObra } from "@/lib/access";
import { db, schema } from "@/lib/db";
import { enviarMensaje } from "@/app/actions/comunicacion";
import { Badge, PageHeader, Progress, Section } from "@/components/ui";
import { avancePrevistoItem, cantidadDe } from "@/lib/engine/calculos";
import { fechaLarga, hoyISO } from "@/lib/engine/calendario";
import { fechaHora, num } from "@/lib/format";
import { Composer, ScrollAbajo } from "../../mensajes/chat-client";

/** Ficha de una tarea con su hilo de comentarios (arquitecto ↔ equipo de obra). */
export default async function Tarea({ params }: { params: Promise<{ id: string; itemId: string }> }) {
  const { id, itemId } = await params;
  const { user, rol } = await requireObra(id, ["arquitecto", "obrero"]);
  const it = await db.query.items.findFirst({ where: and(eq(schema.items.id, itemId), eq(schema.items.obraId, id)) });
  if (!it) notFound();
  const rubro = await db.query.rubros.findFirst({ where: eq(schema.rubros.id, it.rubroId) });
  const canal = `item:${it.id}`;
  const msgs = await db.query.mensajes.findMany({ where: and(eq(schema.mensajes.obraId, id), eq(schema.mensajes.canal, canal)), orderBy: asc(schema.mensajes.createdAt) });
  const avances = await db.query.avances.findMany({ where: eq(schema.avances.itemId, it.id), orderBy: desc(schema.avances.createdAt), limit: 20 });
  const ids = [...new Set([...msgs.map((m) => m.autorId), ...avances.map((a) => a.autorId)])];
  const users = ids.length ? await db.query.users.findMany({ where: inArray(schema.users.id, ids) }) : [];
  const resp = it.asignadoA ? await db.query.miembros.findFirst({ where: eq(schema.miembros.id, it.asignadoA) }) : null;
  const sol = await db.query.solicitudes.findMany({ where: eq(schema.solicitudes.itemId, it.id) });
  const hoy = hoyISO();
  return (
    <>
      <PageHeader title={it.nombre} subtitle={<>{rubro?.codigo} {rubro?.nombre} · <Link href={`/obras/${id}/${rol === "arquitecto" ? "rubros" : "seguimiento"}`} className="text-brand-700 hover:underline">volver</Link></>} actions={<Link href={`/obras/${id}/seguimiento?item=${it.id}#informar`} className="btn-secondary">Informar avance</Link>} />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6">
          <div className="card card-pad space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-zinc-500">Cantidad</span><span>{it.esHito ? "Hito" : `${num(cantidadDe(it))} ${it.unidad}`}</span></div>
            <div className="flex justify-between"><span className="text-zinc-500">Período</span><span>{fechaLarga(it.inicio)} → {fechaLarga(it.fin)}</span></div>
            <div className="flex justify-between"><span className="text-zinc-500">Duración</span><span>{it.duracion} días hábiles</span></div>
            <div className="flex justify-between"><span className="text-zinc-500">Responsable</span><span>{resp?.nombre ?? resp?.email ?? "—"}</span></div>
            <div className="pt-2"><Progress value={it.avanceReal} previsto={avancePrevistoItem(it, hoy)} /><div className="mt-1 text-xs text-zinc-500">Real {it.avanceReal.toFixed(0)}% · previsto {avancePrevistoItem(it, hoy).toFixed(0)}%</div></div>
          </div>
          {sol.length > 0 && (
            <Section title="Pedidos de material de esta tarea">
              <ul className="divide-y divide-zinc-100 text-sm">{sol.map((s) => <li key={s.id} className="flex justify-between px-5 py-2"><span>{num(s.cantidad)} {s.unidad} {s.material}</span><Badge>{s.estado}</Badge></li>)}</ul>
            </Section>
          )}
          <Section title="Avances registrados">
            <ul className="divide-y divide-zinc-100">
              {avances.length === 0 && <li className="muted p-5">Sin avances.</li>}
              {avances.map((a) => (
                <li key={a.id} className="px-5 py-2.5 text-sm">
                  <div className="flex justify-between"><span>{a.tipo === "problema" ? "⚠ Problema" : `${a.avancePct}%`}</span><span className="text-xs text-zinc-400">{fechaHora(a.createdAt)}{a.origen === "whatsapp" ? " · WhatsApp" : ""}</span></div>
                  {a.nota && <p className="text-zinc-600">{a.nota}</p>}
                  <div className="text-xs text-zinc-400">{users.find((u) => u.id === a.autorId)?.nombre}</div>
                </li>
              ))}
            </ul>
          </Section>
        </div>
        <div className="card flex h-[65vh] flex-col lg:col-span-2">
          <div className="border-b border-zinc-100 px-5 py-3"><div className="h2">Comentarios de la tarea</div><div className="text-xs text-zinc-500">Visibles para el arquitecto y el equipo de obra</div></div>
          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            {msgs.length === 0 && <p className="muted py-10 text-center">Sin comentarios todavía.</p>}
            {msgs.map((m) => {
              const mio = m.autorId === user.id;
              return (
                <div key={m.id} className={`flex ${mio ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm ${mio ? "bg-brand-700 text-white" : "bg-zinc-100"}`}>
                    {!mio && <div className="mb-0.5 text-xs font-medium opacity-70">{users.find((u) => u.id === m.autorId)?.nombre}</div>}
                    <div className="whitespace-pre-wrap">{m.texto}</div>
                    {m.adjuntos.map((a) => <a key={a} href={`/api/archivos/${a}`} target="_blank" className="mt-1 block text-xs underline">📎 adjunto</a>)}
                    <div className={`mt-1 text-[10px] ${mio ? "text-white/60" : "text-zinc-400"}`}>{fechaHora(m.createdAt)}</div>
                  </div>
                </div>
              );
            })}
            <ScrollAbajo />
          </div>
          <Composer action={enviarMensaje.bind(null, id, canal)} puedeDecision={rol === "arquitecto"} />
        </div>
      </div>
    </>
  );
}
