import Link from "next/link";
import { and, desc, eq, gte, inArray } from "drizzle-orm";
import { requireObra } from "@/lib/access";
import { resumenObra } from "@/lib/queries";
import { db, schema } from "@/lib/db";
import { Alerta, Badge, PageHeader, Progress, Section, Stat } from "@/components/ui";
import { BarrasHorizontales, CurvaAvance } from "@/components/charts";
import { ars, fechaHora, num, pct } from "@/lib/format";
import { curvaPrevista, finDeObra, avancePrevistoItem } from "@/lib/engine/calculos";
import { diasCorridos, fechaLarga, hoyISO, sumarHabiles } from "@/lib/engine/calendario";
import { SISTEMAS, TIPOS_OBRA } from "@/lib/engine/plantillas";
import { clienteVe } from "@/lib/portal";
import { hoyAR } from "@/lib/format";

const sumarDiasCorridos = (f: string, d: number) => { const x = new Date(`${f}T12:00:00Z`); x.setUTCDate(x.getUTCDate() + d); return x.toISOString().slice(0, 10); };

export default async function ResumenObra({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ nueva?: string }> }) {
  const { id } = await params;
  const { nueva } = await searchParams;
  const { rol, miembroId } = await requireObra(id);
  const r = await resumenObra(id);
  const { obra } = r;
  const hoy = hoyISO();
  const fin = finDeObra(r.items);
  const curva = curvaPrevista(r.items, r.pesos, obra.fechaInicio, fin);
  const b = `/obras/${id}`;
  const enDosSemanas = sumarHabiles(hoy, 10);
  const proximas = r.items.filter((i) => !i.esHito && i.avanceReal < 100 && i.inicio && i.inicio <= enDosSemanas && (i.fin ?? "") >= hoy).slice(0, 8);
  const hitos = r.items.filter((i) => i.esHito);
  const nombreMiembro = new Map(r.miembros.map((m) => [m.id, m.nombre ?? m.email]));

  const fotos = await db.query.documentos.findMany({
    where: and(eq(schema.documentos.obraId, id), eq(schema.documentos.categoria, "foto"), ...(rol === "cliente" ? [eq(schema.documentos.visibleCliente, true)] : [])),
    orderBy: desc(schema.documentos.createdAt),
    limit: 6,
  });

  const subtitulo = `${obra.codigo} · ${TIPOS_OBRA[obra.tipo as keyof typeof TIPOS_OBRA]} · ${SISTEMAS[obra.sistema as keyof typeof SISTEMAS]} · ${num(obra.supCubierta, 1)} m²${obra.supSemicubierta ? ` + ${num(obra.supSemicubierta, 1)} m² semicub.` : ""}`;

  // ───── Obrero: interfaz simple y móvil ─────
  if (rol === "obrero") {
    const parteHoy = await db.query.partesDiarios.findFirst({ where: and(eq(schema.partesDiarios.obraId, id), eq(schema.partesDiarios.fecha, hoyAR())) });
    const mias = r.items.filter((i) => !i.esHito && i.avanceReal < 100 && (!i.asignadoA || i.asignadoA === miembroId) && i.inicio && i.inicio <= enDosSemanas);
    return (
      <div className="mx-auto max-w-xl space-y-4">
        <PageHeader title={obra.nombre} subtitle={[obra.direccion, obra.localidad].filter(Boolean).join(", ")} />
        <Link href={`${b}/partes`} className={`flex items-center justify-between rounded-2xl p-5 ${parteHoy ? "bg-brand-50 text-brand-800" : "bg-brand-700 text-white"}`}>
          <span>
            <span className="block text-lg font-semibold">{parteHoy ? "✓ Parte de hoy cargado" : "Cargar el parte del día"}</span>
            <span className="block text-sm opacity-80">{parteHoy ? "Si pasó algo más, podés sumar otro." : "Quiénes vinieron, el clima y qué se hizo. 1 minuto."}</span>
          </span>
          <span className="text-2xl">→</span>
        </Link>
        <div className="grid grid-cols-2 gap-3">
          <Link href={`${b}/seguimiento`} className="btn-secondary py-4 text-base">Informar avance</Link>
          <Link href={`${b}/solicitudes`} className="btn-secondary py-4 text-base">Pedir material</Link>
          <Link href={`${b}/seguimiento?problema=1`} className="btn-secondary py-4 text-base">Informar problema</Link>
          <Link href={`${b}/mensajes?canal=obra`} className="btn-secondary py-4 text-base">Hablar con arquitecto</Link>
        </div>
        <Section title="Tareas para estas dos semanas">
          <ul className="divide-y divide-zinc-100">
            {mias.length === 0 && <li className="muted p-5">No tenés tareas en este período.</li>}
            {mias.map((i) => (
              <li key={i.id} className="px-5 py-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-medium">{i.nombre}</div>
                  {i.asignadoA === miembroId && <Badge tono="verde">Asignada a vos</Badge>}
                </div>
                <div className="mt-0.5 text-sm text-zinc-500">{num(i.cantidadManual ?? i.cantidadCalc)} {i.unidad} · {fechaLarga(i.inicio)} al {fechaLarga(i.fin)}</div>
                <div className="mt-2"><Progress value={i.avanceReal} previsto={avancePrevistoItem(i, hoy)} small /></div>
              </li>
            ))}
          </ul>
        </Section>
      </div>
    );
  }

  const esArq = rol === "arquitecto";
  const veP = esArq || clienteVe(obra, "presupuesto");
  const veC = esArq || clienteVe(obra, "compras");
  const precioVenta = r.presupuesto.total;
  const adicionales = await db.query.adicionales.findMany({ where: eq(schema.adicionales.obraId, id) });
  const totalAdicionales = adicionales.filter((a) => a.estado === "aprobado").reduce((a, x) => a + x.monto, 0);
  const actividad = esArq
    ? await db.query.auditoria.findMany({ where: eq(schema.auditoria.obraId, id), orderBy: desc(schema.auditoria.createdAt), limit: 8 })
    : [];
  const usuariosAct = actividad.length ? await db.query.users.findMany({ where: inArray(schema.users.id, actividad.map((a) => a.userId!).filter(Boolean)) }) : [];

  // ───── Arquitecto: vista simple — lo importante primero, el detalle en "Ver más" ─────
  if (esArq) {
    const orden = { critico: 0, aviso: 1, info: 2 } as const;
    const partesProblema = await db.query.partesDiarios.findMany({ where: and(eq(schema.partesDiarios.obraId, id), gte(schema.partesDiarios.fecha, sumarDiasCorridos(hoyAR(), -3))), orderBy: desc(schema.partesDiarios.fecha) });
    const alertasPartes = partesProblema.filter((p) => p.problema).map((p) => ({ nivel: "critico" as const, texto: `Parte del ${p.fecha.split("-").reverse().slice(0, 2).join("/")}: ${p.problema}`, link: `${b}/partes` }));
    const atencion = [...alertasPartes, ...r.alertas].sort((a, z) => orden[a.nivel] - orden[z.nivel]).slice(0, 4);
    const semana = r.items.filter((i) => !i.esHito && i.avanceReal < 100 && i.inicio && i.inicio <= sumarHabiles(hoy, 5) && (i.fin ?? "") >= hoy).slice(0, 5);
    const desvio = r.avance.desvio;
    return (
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{obra.nombre}</h1>
            <p className="mt-1 text-[15px] text-zinc-500">{[obra.localidad, `${num(obra.supCubierta, 0)} m²`, obra.clienteNombre].filter(Boolean).join(" · ")}</p>
          </div>
          <Link href={`${b}/datos`} className="btn-secondary px-4 py-2.5 text-[15px]">Editar obra</Link>
        </div>

        {nueva && (
          <div className="mb-6 rounded-2xl bg-brand-50 p-5 text-[15px] text-brand-900">
            <div className="text-base font-semibold">¡Obra creada! Ya se armaron las tareas, cantidades y el cronograma.</div>
            <p className="mt-1">Próximo paso: cargá los precios para completar el presupuesto.</p>
            <Link href={`${b}/precios`} className="btn-primary mt-3 px-4 py-2.5 text-[15px]">Cargar precios</Link>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="card p-5">
            <div className="text-sm text-zinc-500">Avance</div>
            <div className="mt-1 text-3xl font-semibold tabular-nums">{pct(r.avance.real, 0)}</div>
            <div className="mt-3"><Progress value={r.avance.real} previsto={r.avance.previsto} /></div>
            <div className={`mt-2 text-sm ${desvio < -10 ? "text-red-700" : desvio < -3 ? "text-amber-700" : "text-brand-700"}`}>
              {desvio < -3 ? `Atrasada ${Math.abs(desvio).toFixed(0)} puntos` : "En tiempo"}
            </div>
          </div>
          <div className="card p-5">
            <div className="text-sm text-zinc-500">Termina</div>
            <div className="mt-1 text-3xl font-semibold">{fechaLarga(fin)}</div>
            <Link href={`${b}/gantt`} className="mt-3 inline-block text-sm font-medium text-brand-700 hover:underline">Ver cronograma →</Link>
          </div>
          <div className="card p-5">
            <div className="text-sm text-zinc-500">Presupuesto</div>
            {r.presupuesto.faltanPrecios ? (
              <>
                <div className="mt-1 text-xl font-semibold text-amber-700">Faltan {r.presupuesto.faltanPrecios} precios</div>
                <Link href={`${b}/precios`} className="mt-3 inline-block text-sm font-medium text-brand-700 hover:underline">Cargar precios →</Link>
              </>
            ) : (
              <>
                <div className="mt-1 text-3xl font-semibold tabular-nums">{ars(precioVenta + totalAdicionales)}</div>
                <div className="mt-3 text-sm text-zinc-500">Gastado {ars(r.reales.total)}</div>
              </>
            )}
          </div>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <section className="card p-5">
            <h2 className="text-lg font-semibold">Necesita tu atención</h2>
            <div className="mt-3 space-y-2">
              {atencion.length === 0 && <p className="text-[15px] text-brand-700">✓ Todo en orden.</p>}
              {atencion.map((a, i) => (
                <Link key={i} href={a.link ?? b} className={`flex items-start gap-3 rounded-xl px-3 py-3 text-[15px] hover:bg-zinc-50 ${a.nivel === "critico" ? "text-red-800" : a.nivel === "aviso" ? "text-amber-900" : "text-zinc-700"}`}>
                  <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${a.nivel === "critico" ? "bg-red-500" : a.nivel === "aviso" ? "bg-amber-500" : "bg-zinc-300"}`} />
                  <span className="flex-1">{a.texto}</span>
                  <span className="text-zinc-400">→</span>
                </Link>
              ))}
            </div>
          </section>
          <section className="card p-5">
            <h2 className="text-lg font-semibold">Esta semana</h2>
            <ul className="mt-3 space-y-3">
              {semana.length === 0 && <li className="text-[15px] text-zinc-500">No hay tareas en curso esta semana.</li>}
              {semana.map((i) => (
                <li key={i.id}>
                  <div className="flex justify-between gap-3 text-[15px]"><span className="truncate">{i.nombre}</span><span className="shrink-0 tabular-nums text-zinc-500">{i.avanceReal.toFixed(0)}%</span></div>
                  <div className="mt-1.5"><Progress value={i.avanceReal} previsto={avancePrevistoItem(i, hoy)} small /></div>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <details className="group mt-6">
          <summary className="cursor-pointer list-none rounded-xl border border-zinc-200 bg-white px-5 py-3.5 text-[15px] font-medium text-zinc-700 hover:bg-zinc-50">
            <span className="group-open:hidden">Ver más detalles (curva de avance, costos por rubro, fotos, hitos, actividad) ▾</span>
            <span className="hidden group-open:inline">Ocultar detalles ▴</span>
          </summary>
          <div className="mt-4 grid gap-6 lg:grid-cols-2">
            <Section title="Curva de avance"><div className="p-4"><CurvaAvance puntos={curva} hoy={hoy} real={r.avance.real} /></div></Section>
            {r.presupuesto.costoDirecto > 0 && (
              <Section title="Costo por rubro: previsto vs gastado">
                <div className="p-5"><BarrasHorizontales formato={(n) => ars(n)} datos={r.presupuesto.rubros.filter((x) => x.subtotal > 0).map((x) => ({ label: x.rubro.nombre, valor: x.subtotal, extra: r.reales.porRubro.get(x.rubro.id) ?? 0 }))} /></div>
              </Section>
            )}
            {fotos.length > 0 && (
              <Section title="Últimas fotos">
                <div className="grid grid-cols-3 gap-2 p-4">
                  {fotos.map((f) => (
                    <a key={f.id} href={`/api/archivos/${f.id}`} target="_blank" className="block aspect-square overflow-hidden rounded-lg bg-zinc-100">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={`/api/archivos/${f.id}`} alt={f.nombre} className="h-full w-full object-cover" />
                    </a>
                  ))}
                </div>
              </Section>
            )}
            <Section title="Hitos">
              <ul className="divide-y divide-zinc-100">
                {hitos.map((h) => <li key={h.id} className="flex justify-between px-5 py-2.5 text-sm"><span>{h.nombre}</span><span className="text-zinc-600">{fechaLarga(h.inicio)}</span></li>)}
              </ul>
            </Section>
            <Section title="Actividad reciente">
              <ul className="divide-y divide-zinc-100">
                {actividad.map((a) => (
                  <li key={a.id} className="px-5 py-2.5 text-xs">
                    <span className="font-medium">{usuariosAct.find((u) => u.id === a.userId)?.nombre ?? "Sistema"}</span> · {a.accion} <span className="text-zinc-400">· {fechaHora(a.createdAt)}</span>
                  </li>
                ))}
              </ul>
            </Section>
          </div>
        </details>
      </div>
    );
  }

  return (
    <>
      <PageHeader title={obra.nombre} subtitle={subtitulo} actions={esArq && <Link href={`${b}/datos`} className="btn-secondary">Editar datos</Link>} />

      {nueva && esArq && (
        <div className="card mb-6 border-brand-500 bg-brand-50 p-5">
          <div className="h2 text-brand-900">La obra está creada y sus planillas ya se generaron</div>
          <p className="mt-1 text-sm text-brand-900">
            Se generaron {r.rubros.length} rubros y {r.items.length} ítems con sus cantidades, {r.insumos.length} insumos con análisis de precios y el cronograma completo, que termina el {fechaLarga(fin)}.
            El siguiente paso es <Link className="font-medium underline" href={`${b}/precios`}>cargar los precios de los insumos</Link> para completar el presupuesto. Si querés ajustar las medidas, revisá los <Link className="font-medium underline" href={`${b}/datos#parametros`}>parámetros de cómputo</Link>.
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Avance real" value={pct(r.avance.real, 0)} hint={`Previsto a hoy: ${pct(r.avance.previsto, 0)}`} tone={r.avance.desvio < -10 ? "bad" : r.avance.desvio < -3 ? "warn" : "ok"} />
        <Stat label="Fin estimado" value={fechaLarga(fin)} hint={fin ? `${diasCorridos(obra.fechaInicio, fin)} días corridos desde el inicio` : undefined} />
        {esArq ? (
          <>
            <Stat label="Presupuesto total" value={r.presupuesto.faltanPrecios ? "Incompleto" : ars(precioVenta)} hint={r.presupuesto.faltanPrecios ? `${r.presupuesto.faltanPrecios} insumos sin precio` : `CD ${ars(r.presupuesto.costoDirecto)}`} tone={r.presupuesto.faltanPrecios ? "warn" : undefined} />
            <Stat label="Ejecutado" value={ars(r.reales.total)} hint={`Pagado ${ars(r.reales.pagado)} · a pagar ${ars(r.reales.pendiente)}`} />
          </>
        ) : (
          <>
            {veP && <Stat label="Presupuesto aprobado" value={r.presupuesto.faltanPrecios ? "En preparación" : ars(precioVenta + totalAdicionales)} hint={totalAdicionales ? `Incluye adicionales por ${ars(totalAdicionales)}` : undefined} />}
            {veC && <Stat label="Gastado a la fecha" value={ars(r.reales.total)} />}
          </>
        )}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Section title="Curva de avance" actions={(esArq || clienteVe(obra, "cronograma")) && <Link href={`${b}/gantt`} className="text-xs text-brand-700 hover:underline">Ver Gantt</Link>}>
            <div className="p-4">
              <CurvaAvance puntos={curva} hoy={hoy} real={r.avance.real} />
              <p className="mt-2 text-xs text-zinc-500">La línea punteada es el avance previsto acumulado (ponderado por {r.avance.ponderadoPor}) y el punto es el avance real informado.</p>
            </div>
          </Section>

          <Section title="Próximas tareas (2 semanas)">
            <div className="overflow-x-auto">
              <table className="tbl">
                <thead><tr><th>Tarea</th><th>Período</th><th>Responsable</th><th className="w-40">Avance</th></tr></thead>
                <tbody>
                  {proximas.length === 0 && <tr><td colSpan={4} className="muted">No hay tareas en este período.</td></tr>}
                  {proximas.map((i) => (
                    <tr key={i.id}>
                      <td>{i.nombre}</td>
                      <td className="whitespace-nowrap text-zinc-600">{fechaLarga(i.inicio)} – {fechaLarga(i.fin)}</td>
                      <td className="text-zinc-600">{i.asignadoA ? nombreMiembro.get(i.asignadoA) : "—"}</td>
                      <td><Progress value={i.avanceReal} previsto={avancePrevistoItem(i, hoy)} small /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          {esArq && r.presupuesto.costoDirecto > 0 && (
            <Section title="Costo directo por rubro: presupuestado vs ejecutado">
              <div className="p-5">
                <BarrasHorizontales formato={(n) => ars(n)} datos={r.presupuesto.rubros.filter((x) => x.subtotal > 0).map((x) => ({ label: `${x.rubro.codigo} ${x.rubro.nombre}`, valor: x.subtotal, extra: r.reales.porRubro.get(x.rubro.id) ?? 0 }))} />
              </div>
            </Section>
          )}

          {fotos.length > 0 && (esArq || clienteVe(obra, "avances")) && (
            <Section title="Últimas fotos" actions={<Link href={`${b}/seguimiento`} className="text-xs text-brand-700 hover:underline">Ver avances</Link>}>
              <div className="grid grid-cols-3 gap-2 p-4">
                {fotos.map((f) => (
                  <a key={f.id} href={`/api/archivos/${f.id}`} target="_blank" className="block aspect-square overflow-hidden rounded-lg bg-zinc-100">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`/api/archivos/${f.id}`} alt={f.nombre} className="h-full w-full object-cover" />
                  </a>
                ))}
              </div>
            </Section>
          )}
        </div>

        <div className="space-y-6">
          {esArq ? (
            <div>
              <h2 className="h2 mb-3">Alertas y pendientes</h2>
              <div className="space-y-2">
                {r.alertas.length === 0 && <p className="muted">Todo en orden.</p>}
                {r.alertas.map((a, i) => <Alerta key={i} {...a} />)}
              </div>
            </div>
          ) : (
            <div>
              <h2 className="h2 mb-3">Para revisar</h2>
              <div className="space-y-2">
                {veP && adicionales.filter((a) => a.estado === "pendiente").map((a) => <Alerta key={a.id} nivel="aviso" texto={`Adicional para aprobar: ${a.titulo} (${ars(a.monto)})`} link={`${b}/presupuesto`} />)}
                {veC && r.reales.compras.filter((c) => c.aprobacionCliente === "pendiente").map((c) => <Alerta key={c.id} nivel="aviso" texto={`Compra para aprobar: ${c.descripcion} (${ars(c.total)})`} link={`${b}/compras`} />)}
                {r.atrasados.length > 0 && <Alerta nivel="info" texto={`Hay ${r.atrasados.length} tareas demoradas respecto del cronograma.`} link={`${b}/gantt`} />}
                {!(veP && adicionales.some((a) => a.estado === "pendiente")) && !(veC && r.reales.compras.some((c) => c.aprobacionCliente === "pendiente")) && <p className="muted">No hay nada pendiente de tu aprobación.</p>}
              </div>
            </div>
          )}

          <Section title="Hitos">
            <ul className="divide-y divide-zinc-100">
              {hitos.map((h) => (
                <li key={h.id} className="flex items-center justify-between px-5 py-2.5 text-sm">
                  <span>{h.nombre}</span>
                  <span className={`tabular-nums ${h.inicio && h.inicio < hoy ? "text-zinc-400" : "text-zinc-700"}`}>{fechaLarga(h.inicio)}</span>
                </li>
              ))}
            </ul>
          </Section>

          {esArq && (
            <Section title="Actividad reciente">
              <ul className="divide-y divide-zinc-100">
                {actividad.map((a) => (
                  <li key={a.id} className="px-5 py-2.5 text-xs">
                    <div className="text-zinc-800"><span className="font-medium">{usuariosAct.find((u) => u.id === a.userId)?.nombre ?? "Sistema"}</span> · {a.accion}</div>
                    {a.detalle && <div className="truncate text-zinc-500">{a.detalle}</div>}
                    <div className="text-zinc-400">{fechaHora(a.createdAt)}</div>
                  </li>
                ))}
              </ul>
            </Section>
          )}
        </div>
      </div>
    </>
  );
}
