import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { obrasDelUsuario, resumenObra } from "@/lib/queries";
import { Alerta, Badge, Empty, PageHeader, Progress, Stat } from "@/components/ui";
import { ars, pct, ROL_LABEL } from "@/lib/format";
import { fechaLarga, hoyISO } from "@/lib/engine/calendario";
import { finDeObra } from "@/lib/engine/calculos";
import { db, schema } from "@/lib/db";
import { and, desc, eq } from "drizzle-orm";

export default async function Dashboard() {
  const user = await requireUser();
  const obras = await obrasDelUsuario(user);
  const activas = obras.filter((o) => o.obra.estado !== "finalizada");
  const resumenes = await Promise.all(activas.map(async (o) => ({ ...o, r: await resumenObra(o.obra.id) })));
  const notifs = await db.query.notificaciones.findMany({ where: and(eq(schema.notificaciones.userId, user.id)), orderBy: desc(schema.notificaciones.createdAt), limit: 6 });

  const comoArq = resumenes.filter((x) => x.rol === "arquitecto");
  const totalAtrasadas = comoArq.reduce((a, x) => a + x.r.atrasados.length, 0);
  const totalSolicitudes = comoArq.reduce((a, x) => a + x.r.solicitudesPendientes.length, 0);
  const cartera = comoArq.reduce((a, x) => a + x.r.presupuesto.total, 0);
  const hoy = hoyISO();
  const misTareas = resumenes
    .filter((x) => x.rol === "obrero")
    .flatMap((x) => x.r.items.filter((i) => !i.esHito && i.avanceReal < 100 && i.inicio && i.inicio <= hoy && (!x.miembroId || !i.asignadoA || i.asignadoA === x.miembroId)).map((i) => ({ obra: x.obra, item: i })));

  return (
    <>
      <PageHeader title={`Hola, ${user.nombre.split(" ")[0]}`} subtitle={fechaLarga(hoy)} actions={<Link href="/obras/nueva" className="btn-primary">+ Nueva obra</Link>} />
      {obras.length === 0 ? (
        <Empty title="Todavía no tenés obras" action={<Link href="/obras/nueva" className="btn-primary">Crear mi primera obra</Link>}>
          Creá una obra con sus datos básicos y la plataforma genera rubros, cómputo, análisis de precios, presupuesto y Gantt. Si te invitaron a una obra, pedile al arquitecto que use este email: {user.email}
        </Empty>
      ) : (
        <div className="space-y-6">
          {comoArq.length === 0 && <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Stat label="Obras activas" value={activas.length} hint={`${obras.length - activas.length} finalizadas`} />
            {comoArq.length > 0 ? (
              <>
                <Stat label="Tareas atrasadas" value={totalAtrasadas} tone={totalAtrasadas ? "bad" : "ok"} />
                <Stat label="Solicitudes pendientes" value={totalSolicitudes} tone={totalSolicitudes ? "warn" : undefined} />
                <Stat label="Cartera presupuestada" value={ars(cartera)} hint="Total con coeficientes" />
              </>
            ) : (
              <Stat label="Tareas para hoy" value={misTareas.length} />
            )}
          </div>}

          <div className="grid gap-6 lg:grid-cols-3">
            <div className="space-y-4 lg:col-span-2">
              <h2 className="text-lg font-semibold">Obras en curso</h2>
              {resumenes.map(({ obra, rol, r }) => (
                <Link key={obra.id} href={`/obras/${obra.id}`} className="card card-pad block transition hover:border-zinc-300 hover:shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="font-medium">{obra.nombre}</div>
                      <div className="muted">{[obra.direccion, obra.localidad].filter(Boolean).join(", ") || obra.codigo}</div>
                    </div>
                    <div className="flex gap-1.5">
                      <Badge>{ROL_LABEL[rol]}</Badge>
                      {r.atrasados.length > 0 && <Badge tono="rojo">{r.atrasados.length} atrasadas</Badge>}
                    </div>
                  </div>
                  <div className="mt-4">
                    <div className="mb-1 flex justify-between text-xs text-zinc-500">
                      <span>Avance real {pct(r.avance.real, 0)}</span>
                      <span>Previsto {pct(r.avance.previsto, 0)}</span>
                    </div>
                    <Progress value={r.avance.real} previsto={r.avance.previsto} />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-zinc-500">
                    <span>Inicio {fechaLarga(obra.fechaInicio)}</span>
                    <span>Fin estimado {fechaLarga(finDeObra(r.items))}</span>
                    {rol === "arquitecto" && <span>Presupuesto {r.presupuesto.faltanPrecios ? "incompleto" : ars(r.presupuesto.total)}</span>}
                  </div>
                </Link>
              ))}
              {misTareas.length > 0 && (
                <div className="card">
                  <div className="border-b border-zinc-100 px-5 py-3 h2">Mis tareas en curso</div>
                  <ul className="divide-y divide-zinc-100">
                    {misTareas.map(({ obra, item }) => (
                      <li key={item.id}>
                        <Link href={`/obras/${obra.id}/seguimiento`} className="flex items-center justify-between px-5 py-3 hover:bg-zinc-50">
                          <div>
                            <div className="text-sm font-medium">{item.nombre}</div>
                            <div className="text-xs text-zinc-500">{obra.nombre} · hasta {fechaLarga(item.fin)}</div>
                          </div>
                          <span className="text-sm tabular-nums">{item.avanceReal}%</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            <div className="space-y-6">
              {comoArq.length > 0 && (
                <div>
                  <h2 className="mb-3 text-lg font-semibold">Necesita tu atención</h2>
                  <div className="space-y-2">
                    {comoArq.flatMap((x) => x.r.alertas.filter((a) => a.nivel !== "info").map((a, i) => ({ k: x.obra.id + i, ...a, texto: `${x.obra.nombre}: ${a.texto}` }))).sort((a, z) => (a.nivel === "critico" ? 0 : 1) - (z.nivel === "critico" ? 0 : 1)).slice(0, 5).map(({ k, ...a }) => <Alerta key={k} {...a} />)}
                    {comoArq.every((x) => x.r.alertas.every((a) => a.nivel === "info")) && <p className="muted">Sin alertas importantes.</p>}
                  </div>
                </div>
              )}
              <div>
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="h2">Actividad reciente</h2>
                  <Link href="/notificaciones" className="text-xs text-brand-700 hover:underline">Ver todo</Link>
                </div>
                <div className="card divide-y divide-zinc-100">
                  {notifs.length === 0 && <p className="muted p-4">Sin novedades.</p>}
                  {notifs.map((n) => (
                    <Link key={n.id} href={n.link ?? "#"} className={`block px-4 py-3 text-sm hover:bg-zinc-50 ${n.leida ? "text-zinc-500" : "text-zinc-900"}`}>
                      {n.texto}
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
