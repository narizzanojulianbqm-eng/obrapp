import { desc, eq } from "drizzle-orm";
import { requireObra } from "@/lib/access";
import { resumenObra } from "@/lib/queries";
import { db, schema } from "@/lib/db";
import { Badge, Estado, Field, PageHeader, Section, Stat } from "@/components/ui";
import { ActionForm } from "@/components/forms/form-state";
import { ConfirmAction } from "@/components/client";
import { actualizarCoeficientes, crearAdicional, evaluarCambio, responderAdicional } from "@/app/actions/obra";
import { fechaHora } from "@/lib/format";
import { ars, num, pct } from "@/lib/format";

export default async function Presupuesto({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { rol } = await requireObra(id, ["arquitecto", "cliente"]);
  const r = await resumenObra(id);
  const { obra, presupuesto: p } = r;
  const adicionales = await db.query.adicionales.findMany({ where: eq(schema.adicionales.obraId, id), orderBy: desc(schema.adicionales.createdAt) });
  const aprobados = adicionales.filter((a) => a.estado === "aprobado").reduce((a, x) => a + x.monto, 0);
  const esArq = rol === "arquitecto";
  const coef = p.coeficienteResumen;
  const cambios = await db.query.cambios.findMany({ where: eq(schema.cambios.obraId, id), orderBy: desc(schema.cambios.createdAt) });
  const nombreItem = new Map(r.items.map((i) => [i.id, i.nombre]));
  const listaCambios = cambios.length > 0 && (
    <Section title="Cambios solicitados por el cliente" className="scroll-mt-20">
      <ul id="cambios" className="divide-y divide-zinc-100">
        {cambios.map((c) => (
          <li key={c.id} className="px-5 py-3 text-sm">
            <div className="flex items-center justify-between gap-2"><span className="font-medium">{c.descripcion}</span><Estado e={c.estado === "solicitado" ? "pendiente" : c.estado === "evaluado" ? "enviada" : c.estado} /></div>
            <div className="mt-0.5 text-xs text-zinc-500">{fechaHora(c.createdAt)}{c.origen === "whatsapp" ? " · vía WhatsApp" : ""}{c.itemsAfectados.length ? ` · afecta: ${c.itemsAfectados.map((x) => nombreItem.get(x)).filter(Boolean).join(", ")}` : ""}</div>
            {esArq && c.costoAfectado ? <div className="mt-1 text-xs text-zinc-600">Precio actual de lo afectado: {ars(c.costoAfectado)}</div> : null}
            {c.impactoMonto != null && <div className="mt-1 text-xs">Impacto: <b>{ars(c.impactoMonto)}</b>{c.impactoDias ? ` · ${c.impactoDias} días hábiles` : ""}{c.respuestaArquitecto ? ` · ${c.respuestaArquitecto}` : ""}</div>}
            {esArq && c.estado === "solicitado" && (
              <ActionForm action={evaluarCambio.bind(null, c.id)} submitLabel="Enviar propuesta al cliente" submitClass="btn-primary btn-sm" className="mt-2">
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Impacto económico ($)"><input name="impactoMonto" className="input" inputMode="decimal" required /></Field>
                  <Field label="Impacto en plazo (días)"><input name="impactoDias" className="input" inputMode="numeric" defaultValue="0" /></Field>
                  <Field label="Comentario para el cliente" className="col-span-2"><input name="respuesta" className="input" /></Field>
                </div>
              </ActionForm>
            )}
          </li>
        ))}
      </ul>
    </Section>
  );

  const listaAdicionales = (
    <Section title="Presupuestos adicionales">
      <ul className="divide-y divide-zinc-100">
        {adicionales.length === 0 && <li className="muted p-5">No hay adicionales.</li>}
        {adicionales.map((a) => (
          <li key={a.id} className="px-5 py-3 text-sm">
            <div className="flex items-center justify-between gap-2"><span className="font-medium">{a.titulo}</span><Estado e={a.estado} /></div>
            {a.descripcion && <p className="mt-0.5 text-zinc-600">{a.descripcion}</p>}
            <div className="mt-1 font-medium tabular-nums">{ars(a.monto)}</div>
            {a.respuestaCliente && <p className="mt-1 text-xs text-zinc-500">Respuesta: {a.respuestaCliente}</p>}
            {rol === "cliente" && a.estado === "pendiente" && (
              <div className="mt-2 flex gap-2">
                <ConfirmAction action={responderAdicional.bind(null, a.id, "aprobado", undefined)} label="Aprobar" className="btn-primary btn-sm" title={`¿Aprobar "${a.titulo}" por ${ars(a.monto)}?`} message="El monto se suma al presupuesto de la obra." confirmLabel="Aprobar" />
                <ConfirmAction action={responderAdicional.bind(null, a.id, "rechazado", undefined)} label="Rechazar" title={`¿Rechazar "${a.titulo}"?`} confirmLabel="Rechazar" />
              </div>
            )}
          </li>
        ))}
      </ul>
    </Section>
  );

  if (!esArq) {
    return (
      <>
        <PageHeader title="Presupuesto de la obra" subtitle="Precios finales por rubro. Los adicionales que apruebes se suman al total." />
        {p.faltanPrecios > 0 ? (
          <div className="card card-pad muted">El arquitecto todavía está completando el presupuesto.</div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-3">
            <Section title="Presupuesto por rubro" className="lg:col-span-2">
              <table className="tbl">
                <thead><tr><th>Rubro</th><th className="num">Importe</th><th className="num">Incidencia</th></tr></thead>
                <tbody>
                  {p.rubros.filter((x) => x.subtotal > 0).map((x) => [
                    <tr key={x.rubro.id}><td className="font-medium">{x.rubro.codigo} {x.rubro.nombre}</td><td className="num">{ars(x.subtotal * coef)}</td><td className="num text-zinc-500">{pct(x.incidencia)}</td></tr>,
                    ...(obra.clientePuedeVerDetalle ? x.items.map((it) => <tr key={it.item.id} className="text-zinc-600"><td className="pl-8 text-xs">{it.item.nombre} · {num(it.cantidad)} {it.item.unidad}</td><td className="num text-xs">{ars(it.parcial * coef)}</td><td /></tr>) : []),
                  ])}
                  <tr className="font-semibold"><td>Total presupuesto</td><td className="num">{ars(p.total)}</td><td /></tr>
                  {aprobados > 0 && <tr><td>Adicionales aprobados</td><td className="num">{ars(aprobados)}</td><td /></tr>}
                  {aprobados > 0 && <tr className="font-semibold"><td>Total actualizado</td><td className="num">{ars(p.total + aprobados)}</td><td /></tr>}
                </tbody>
              </table>
            </Section>
            <div className="space-y-6">{listaAdicionales}{listaCambios}</div>
          </div>
        )}
      </>
    );
  }

  return (
    <>
      <PageHeader title="Presupuesto general" subtitle="Vinculado al cómputo y al análisis de precios. Cualquier cambio en cantidades, consumos o precios se refleja acá." actions={<><a href={`/api/obras/${id}/excel`} className="btn-secondary">Exportar a Excel</a><a href={`/obras/${id}/reporte?tipo=presupuesto`} className="btn-secondary">Imprimir / PDF</a></>} />
      {p.faltanPrecios > 0 && <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-900">Hay {p.faltanPrecios} insumos sin precio: los importes están incompletos. <a className="font-medium underline" href={`/obras/${id}/precios`}>Cargar precios</a></div>}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Costo directo" value={ars(p.costoDirecto)} hint={`Mat ${ars(p.materiales)} · MO ${ars(p.manoObra)}`} />
        <Stat label="Precio total" value={ars(p.total)} hint={`Coeficiente resumen ${num(coef, 3)}`} />
        <Stat label="Costo por m²" value={obra.supCubierta ? ars(p.total / obra.supCubierta) : "—"} hint="Total / sup. cubierta" />
        <Stat label="Adicionales aprobados" value={ars(aprobados)} hint={obra.presupuestoInicial ? `Presupuesto inicial ${ars(obra.presupuestoInicial)}` : undefined} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Section title="Planilla de presupuesto" className="lg:col-span-2">
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead><tr><th>Ítem</th><th>Descripción</th><th>Un.</th><th className="num">Cantidad</th><th className="num">P. unitario</th><th className="num">Parcial</th><th className="num">Inc.</th></tr></thead>
              <tbody>
                {p.rubros.map((x) => [
                  <tr key={x.rubro.id} className="bg-zinc-50/80 font-medium"><td>{x.rubro.codigo}</td><td>{x.rubro.nombre}</td><td /><td /><td /><td className="num">{ars(x.subtotal)}</td><td className="num">{pct(x.incidencia)}</td></tr>,
                  ...x.items.map((it, k) => (
                    <tr key={it.item.id}>
                      <td className="text-xs text-zinc-400">{x.rubro.codigo}.{String(k + 1).padStart(2, "0")}</td>
                      <td>{it.item.nombre}{it.apu.faltanPrecios > 0 && <span className="ml-1"><Badge tono="ambar">incompleto</Badge></span>}</td>
                      <td className="text-zinc-500">{it.item.unidad}</td>
                      <td className="num">{num(it.cantidad)}</td>
                      <td className="num">{ars(it.apu.unitario, 2)}</td>
                      <td className="num">{ars(it.parcial)}</td>
                      <td className="num text-xs text-zinc-400">{p.costoDirecto ? pct((it.parcial / p.costoDirecto) * 100) : "—"}</td>
                    </tr>
                  )),
                ])}
              </tbody>
            </table>
          </div>
        </Section>

        <div className="space-y-6">
          <Section title="Resumen">
            <table className="tbl">
              <tbody>
                <tr><td>Costo directo</td><td className="num">{ars(p.costoDirecto)}</td></tr>
                <tr><td className="text-zinc-600">Gastos generales / indirectos ({obra.gastosGeneralesPct}%)</td><td className="num">{ars(p.gastosGenerales)}</td></tr>
                <tr className="font-medium"><td>Costo de obra</td><td className="num">{ars(p.costoObra)}</td></tr>
                <tr><td className="text-zinc-600">Beneficio ({obra.beneficioPct}%)</td><td className="num">{ars(p.beneficio)}</td></tr>
                <tr><td className="text-zinc-600">Honorarios ({obra.honorariosPct}%)</td><td className="num">{ars(p.honorarios)}</td></tr>
                <tr><td className="text-zinc-600">IVA ({obra.ivaPct}%)</td><td className="num">{ars(p.iva)}</td></tr>
                <tr className="text-base font-semibold"><td>Total general</td><td className="num">{ars(p.total)}</td></tr>
              </tbody>
            </table>
          </Section>
          <div className="card card-pad">
            <div className="h2 mb-3">Coeficientes</div>
            <ActionForm action={actualizarCoeficientes.bind(null, id)} submitLabel="Aplicar">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Gastos generales %"><input name="gastosGeneralesPct" className="input" defaultValue={obra.gastosGeneralesPct} inputMode="decimal" /></Field>
                <Field label="Beneficio %"><input name="beneficioPct" className="input" defaultValue={obra.beneficioPct} inputMode="decimal" /></Field>
                <Field label="Honorarios %"><input name="honorariosPct" className="input" defaultValue={obra.honorariosPct} inputMode="decimal" /></Field>
                <Field label="IVA %"><input name="ivaPct" className="input" defaultValue={obra.ivaPct} inputMode="decimal" /></Field>
              </div>
              <label className="mt-3 flex items-center gap-2 text-sm"><input type="checkbox" name="clientePuedeVerDetalle" defaultChecked={obra.clientePuedeVerDetalle} /> El cliente puede ver el detalle por ítem (siempre a precio final)</label>
            </ActionForm>
          </div>
          <div className="card card-pad">
            <div className="h2 mb-3">Nuevo adicional para el cliente</div>
            <ActionForm action={crearAdicional.bind(null, id)} resetOnOk submitLabel="Enviar para aprobación">
              <div className="space-y-3">
                <Field label="Título"><input name="titulo" className="input" required placeholder="Cambio de revestimiento de cocina" /></Field>
                <Field label="Descripción"><textarea name="descripcion" rows={2} className="input" /></Field>
                <Field label="Monto ($)"><input name="monto" className="input" inputMode="decimal" required /></Field>
              </div>
            </ActionForm>
          </div>
          {listaCambios}
          {listaAdicionales}
        </div>
      </div>
    </>
  );
}
