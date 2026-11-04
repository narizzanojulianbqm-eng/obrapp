import Link from "next/link";
import { and, desc, eq, inArray } from "drizzle-orm";
import { requireObra } from "@/lib/access";
import { resumenObra } from "@/lib/queries";
import { db, schema } from "@/lib/db";
import { Alerta, Badge, PageHeader, Progress, Section, Stat } from "@/components/ui";
import { BarrasHorizontales, CurvaAvance } from "@/components/charts";
import { ars, fechaHora, num, pct } from "@/lib/format";
import { curvaPrevista, finDeObra, avancePrevistoItem } from "@/lib/engine/calculos";
import { diasCorridos, fechaLarga, hoyISO, sumarHabiles } from "@/lib/engine/calendario";
import { SISTEMAS, TIPOS_OBRA } from "@/lib/engine/plantillas";

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
    const mias = r.items.filter((i) => !i.esHito && i.avanceReal < 100 && (!i.asignadoA || i.asignadoA === miembroId) && i.inicio && i.inicio <= enDosSemanas);
    return (
      <div className="mx-auto max-w-xl space-y-4">
        <PageHeader title={obra.nombre} subtitle={[obra.direccion, obra.localidad].filter(Boolean).join(", ")} />
        <div className="grid grid-cols-2 gap-3">
          <Link href={`${b}/seguimiento`} className="btn-primary py-4 text-base">Informar avance</Link>
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
  const precioVenta = r.presupuesto.total;
  const adicionales = await db.query.adicionales.findMany({ where: eq(schema.adicionales.obraId, id) });
  const totalAdicionales = adicionales.filter((a) => a.estado === "aprobado").reduce((a, x) => a + x.monto, 0);
  const actividad = esArq
    ? await db.query.auditoria.findMany({ where: eq(schema.auditoria.obraId, id), orderBy: desc(schema.auditoria.createdAt), limit: 8 })
    : [];
  const usuariosAct = actividad.length ? await db.query.users.findMany({ where: inArray(schema.users.id, actividad.map((a) => a.userId!).filter(Boolean)) }) : [];

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
            <Stat label="Presupuesto aprobado" value={r.presupuesto.faltanPrecios ? "En preparación" : ars(precioVenta + totalAdicionales)} hint={totalAdicionales ? `Incluye adicionales por ${ars(totalAdicionales)}` : undefined} />
            <Stat label="Gastado a la fecha" value={ars(r.reales.total)} />
          </>
        )}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Section title="Curva de avance" actions={<Link href={`${b}/gantt`} className="text-xs text-brand-700 hover:underline">Ver Gantt</Link>}>
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

          {fotos.length > 0 && (
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
                {adicionales.filter((a) => a.estado === "pendiente").map((a) => <Alerta key={a.id} nivel="aviso" texto={`Adicional para aprobar: ${a.titulo} (${ars(a.monto)})`} link={`${b}/presupuesto`} />)}
                {r.reales.compras.filter((c) => c.aprobacionCliente === "pendiente").map((c) => <Alerta key={c.id} nivel="aviso" texto={`Compra para aprobar: ${c.descripcion} (${ars(c.total)})`} link={`${b}/compras`} />)}
                {r.atrasados.length > 0 && <Alerta nivel="info" texto={`Hay ${r.atrasados.length} tareas demoradas respecto del cronograma.`} link={`${b}/gantt`} />}
                {!adicionales.some((a) => a.estado === "pendiente") && !r.reales.compras.some((c) => c.aprobacionCliente === "pendiente") && <p className="muted">No hay nada pendiente de tu aprobación.</p>}
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
