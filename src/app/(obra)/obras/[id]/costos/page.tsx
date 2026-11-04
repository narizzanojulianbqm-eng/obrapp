import { eq } from "drizzle-orm";
import { requireObra } from "@/lib/access";
import { resumenObra } from "@/lib/queries";
import { db, schema } from "@/lib/db";
import { PageHeader, Section, Stat } from "@/components/ui";
import { ars, num, pct } from "@/lib/format";
import { proyectarObra } from "@/lib/engine/proyeccion";
import { computoMateriales } from "@/lib/engine/calculos";

export default async function Costos({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ rubro?: string; proveedor?: string; desde?: string; hasta?: string }> }) {
  const { id } = await params;
  const f = await searchParams;
  const { obra } = await requireObra(id, ["arquitecto"]);
  const r = await resumenObra(id);
  const p = r.presupuesto;
  const provs = await db.query.proveedores.findMany({ where: eq(schema.proveedores.ownerId, obra.ownerId) });
  const adic = await db.query.adicionales.findMany({ where: eq(schema.adicionales.obraId, id) });
  const aprobados = adic.filter((a) => a.estado === "aprobado").reduce((a, x) => a + x.monto, 0);
  const coef = p.coeficienteResumen;

  // costo previsto por mes, distribuyendo el parcial de cada ítem en sus días
  const previstoMes = new Map<string, number>();
  for (const fr of p.rubros) for (const x of fr.items) {
    const it = x.item;
    if (!it.inicio || !it.fin || x.parcial <= 0) continue;
    const d0 = new Date(it.inicio + "T00:00:00Z"), d1 = new Date(it.fin + "T00:00:00Z");
    const dias = Math.max(1, Math.round((d1.getTime() - d0.getTime()) / 86400000) + 1);
    for (let k = 0; k < dias; k++) {
      const d = new Date(d0); d.setUTCDate(d.getUTCDate() + k);
      const m = d.toISOString().slice(0, 7);
      previstoMes.set(m, (previstoMes.get(m) ?? 0) + (x.parcial * coef) / dias);
    }
  }
  const realMes = new Map<string, number>();
  for (const c of r.reales.compras) if (c.aprobacionCliente !== "rechazada") realMes.set(c.fecha.slice(0, 7), (realMes.get(c.fecha.slice(0, 7)) ?? 0) + c.total);
  const meses = [...new Set([...previstoMes.keys(), ...realMes.keys()])].sort();
  let accP = 0, accR = 0;

  const compras = r.reales.compras.filter((c) => (!f.rubro || c.rubroId === f.rubro) && (!f.proveedor || c.proveedorId === f.proveedor) && (!f.desde || c.fecha >= f.desde) && (!f.hasta || c.fecha <= f.hasta));
  const porProv = new Map<string, number>();
  for (const c of r.reales.compras) porProv.set(c.proveedorId ?? "—", (porProv.get(c.proveedorId ?? "—") ?? 0) + c.total);

  // ── Cómo termina la obra ──
  const proy = proyectarObra(
    p.rubros.map((x) => ({ id: x.rubro.id, nombre: `${x.rubro.codigo} ${x.rubro.nombre}`, presupuestado: x.subtotal, items: x.items.filter((i) => !i.item.esHito).map((i) => ({ peso: i.parcial > 0 ? i.parcial : Math.max(1, i.item.duracion), avance: i.item.avanceReal })) })),
    r.reales.porRubro,
  );
  const vigentes = r.reales.compras.filter((c) => c.aprobacionCliente !== "rechazada");
  const sinRubro = vigentes.filter((c) => !c.rubroId);
  const totalSinRubro = sinRubro.reduce((s, c) => s + c.total, 0);
  const estimadoTotal = proy.estimado + totalSinRubro;
  const desvioTotal = estimadoTotal - proy.presupuestado;
  const computo = computoMateriales(r.items, r.recursos, r.insumos);
  const comprado = new Map<string, number>();
  for (const c of vigentes) if (c.insumoId) comprado.set(c.insumoId, (comprado.get(c.insumoId) ?? 0) + c.cantidad);
  const excesos = computo.filter((m) => (comprado.get(m.insumo.id) ?? 0) > m.cantidad * 1.1).map((m) => ({ nombre: m.insumo.nombre, unidad: m.insumo.unidad, computado: m.cantidad, comprado: comprado.get(m.insumo.id) ?? 0 }));
  const desviados = proy.filas.filter((f) => f.presupuestado > 0 && f.desvio > f.presupuestado * 0.05).sort((a, z) => z.desvio - a.desvio);

  return (
    <>
      <PageHeader title="Costos y beneficios" subtitle="Información privada del arquitecto. Los clientes y obreros no tienen acceso a esta sección." />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Presupuesto inicial" value={ars(obra.presupuestoInicial)} />
        <Stat label="Presupuesto actualizado" value={ars(p.total + aprobados)} hint={`Incluye ${ars(aprobados)} de adicionales`} />
        <Stat label="Costo ejecutado" value={ars(r.reales.total)} hint={`${pct(p.costoObra ? (r.reales.total / p.costoObra) * 100 : 0, 0)} del costo de obra`} />
        <Stat label="Pagos pendientes" value={ars(r.reales.pendiente)} tone={r.reales.pendiente ? "warn" : undefined} />
        <Stat label="Honorarios" value={ars(p.honorarios)} />
        <Stat label="Beneficio previsto" value={ars(p.beneficio)} />
        <Stat label="Margen proyectado" value={ars(p.total + aprobados - Math.max(p.costoObra, r.reales.total) - p.iva)} hint="Precio − costo (mayor entre previsto y real) − IVA" />
        <Stat label="Avance físico" value={pct(r.avance.real, 0)} hint={`Ejecutado económico: ${pct(p.costoObra ? (r.reales.total / p.costoObra) * 100 : 0, 0)}`} />
      </div>

      <section className="card mt-6 p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Cómo termina la obra</h2>
            <p className="muted mt-0.5">Si cada rubro sigue gastando como hasta ahora, el costo directo cerraría así.</p>
          </div>
          <div className="text-right">
            <div className="text-sm text-zinc-500">Estimado al cierre</div>
            <div className="text-2xl font-semibold tabular-nums">{ars(estimadoTotal)}</div>
            <div className={`text-sm font-medium ${desvioTotal > proy.presupuestado * 0.03 ? "text-red-700" : desvioTotal < -proy.presupuestado * 0.03 ? "text-brand-700" : "text-zinc-500"}`}>
              {proy.presupuestado > 0 ? `${desvioTotal > 0 ? "+" : ""}${ars(desvioTotal)} (${desvioTotal > 0 ? "+" : ""}${pct((desvioTotal / proy.presupuestado) * 100, 1)}) vs. presupuesto` : "Cargá precios para comparar"}
            </div>
          </div>
        </div>
        {(desviados.length > 0 || totalSinRubro > 0 || excesos.length > 0) ? (
          <ul className="mt-4 space-y-2 text-[15px]">
            {desviados.slice(0, 4).map((f) => (
              <li key={f.id} className="flex items-start gap-3 rounded-lg bg-red-50 px-3 py-2.5 text-red-900">
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-red-500" />
                <span><b>{f.nombre}</b>: va {pct(f.avance, 0)} hecho y lleva gastado {ars(f.gastado)}. Terminaría en {ars(f.estimado)} (<b>+{ars(f.desvio)}</b>).</span>
              </li>
            ))}
            {totalSinRubro > 0 && (
              <li className="flex items-start gap-3 rounded-lg bg-amber-50 px-3 py-2.5 text-amber-900">
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-amber-500" />
                <span><b>{ars(totalSinRubro)}</b> en {sinRubro.length} compra{sinRubro.length > 1 ? "s" : ""} sin rubro: son gastos fuera del presupuesto. Asignales un rubro en Compras o cobralos como adicional.</span>
              </li>
            )}
            {excesos.slice(0, 4).map((e) => (
              <li key={e.nombre} className="flex items-start gap-3 rounded-lg bg-amber-50 px-3 py-2.5 text-amber-900">
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-amber-500" />
                <span><b>{e.nombre}</b>: se compraron {num(e.comprado)} {e.unidad} y el cómputo pide {num(e.computado)} {e.unidad} ({pct(((e.comprado - e.computado) / e.computado) * 100, 0)} de más).</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-[15px] text-brand-700">✓ Ningún rubro viene excedido y no hay gastos fuera del presupuesto.</p>
        )}
        <details className="mt-4">
          <summary className="cursor-pointer text-sm font-medium text-brand-700">Ver proyección por rubro</summary>
          <div className="mt-2 overflow-x-auto">
            <table className="tbl">
              <thead><tr><th>Rubro</th><th className="num">Avance</th><th className="num">Presupuestado</th><th className="num">Gastado</th><th className="num">Estimado al cierre</th><th className="num">Desvío</th></tr></thead>
              <tbody>
                {proy.filas.filter((f) => f.presupuestado > 0 || f.gastado > 0).map((f) => (
                  <tr key={f.id}>
                    <td>{f.nombre}</td>
                    <td className="num">{pct(f.avance, 0)}</td>
                    <td className="num">{ars(f.presupuestado)}</td>
                    <td className="num">{ars(f.gastado)}</td>
                    <td className="num">{ars(f.estimado)}{f.base === "presupuesto" && <span className="ml-1 text-xs text-zinc-400" title="Todavía no hay avance suficiente para proyectar">*</span>}</td>
                    <td className={`num ${f.desvio > f.presupuestado * 0.05 ? "text-red-700" : f.desvio < 0 ? "text-brand-700" : "text-zinc-500"}`}>{f.desvio ? `${f.desvio > 0 ? "+" : ""}${ars(f.desvio)}` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 text-xs text-zinc-500">* Rubros con menos del 15 % de avance: se toma lo presupuestado. El resto se proyecta con el rendimiento real (gastado ÷ valor del trabajo hecho).</p>
          </div>
        </details>
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Section title="Desvíos por rubro (costo directo vs ejecutado)">
          <table className="tbl">
            <thead><tr><th>Rubro</th><th className="num">Presupuestado</th><th className="num">Ejecutado</th><th className="num">Desvío</th></tr></thead>
            <tbody>
              {p.rubros.map((x) => {
                const real = r.reales.porRubro.get(x.rubro.id) ?? 0;
                const d = real - x.subtotal;
                return (
                  <tr key={x.rubro.id}>
                    <td>{x.rubro.codigo} {x.rubro.nombre}</td>
                    <td className="num">{ars(x.subtotal)}</td>
                    <td className="num">{ars(real)}</td>
                    <td className={`num ${real > x.subtotal * 1.05 ? "text-red-700" : "text-zinc-500"}`}>{real ? `${d > 0 ? "+" : ""}${ars(d)}` : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Section>
        <Section title="Flujo de fondos (previsto según cronograma vs compras registradas)">
          <table className="tbl">
            <thead><tr><th>Mes</th><th className="num">Previsto</th><th className="num">Real</th><th className="num">Acum. previsto</th><th className="num">Acum. real</th></tr></thead>
            <tbody>
              {meses.map((m) => {
                accP += previstoMes.get(m) ?? 0;
                accR += realMes.get(m) ?? 0;
                return <tr key={m}><td>{m.slice(5)}/{m.slice(0, 4)}</td><td className="num">{ars(previstoMes.get(m) ?? 0)}</td><td className="num">{ars(realMes.get(m) ?? 0)}</td><td className="num text-zinc-500">{ars(accP)}</td><td className="num text-zinc-500">{ars(accR)}</td></tr>;
              })}
            </tbody>
          </table>
        </Section>
      </div>

      <Section title="Gastos" className="mt-6">
        <form className="flex flex-wrap items-end gap-2 border-b border-zinc-100 px-5 py-3">
          <label className="text-xs">Rubro<select name="rubro" defaultValue={f.rubro ?? ""} className="input-sm mt-1 block"><option value="">Todos</option>{r.rubros.map((x) => <option key={x.id} value={x.id}>{x.nombre}</option>)}</select></label>
          <label className="text-xs">Proveedor<select name="proveedor" defaultValue={f.proveedor ?? ""} className="input-sm mt-1 block"><option value="">Todos</option>{provs.map((x) => <option key={x.id} value={x.id}>{x.nombre}</option>)}</select></label>
          <label className="text-xs">Desde<input type="date" name="desde" defaultValue={f.desde} className="input-sm mt-1 block" /></label>
          <label className="text-xs">Hasta<input type="date" name="hasta" defaultValue={f.hasta} className="input-sm mt-1 block" /></label>
          <button className="btn-secondary btn-sm">Filtrar</button>
          <span className="ml-auto text-sm font-medium tabular-nums">Total filtrado: {ars(compras.reduce((a, c) => a + c.total, 0))}</span>
        </form>
        <table className="tbl">
          <thead><tr><th>Fecha</th><th>Descripción</th><th>Rubro</th><th>Proveedor</th><th className="num">Total</th><th className="num">Pagado</th></tr></thead>
          <tbody>
            {compras.length === 0 && <tr><td colSpan={6} className="muted">Sin gastos para este filtro.</td></tr>}
            {compras.map((c) => (
              <tr key={c.id}><td>{c.fecha}</td><td>{c.descripcion}</td><td className="text-zinc-500">{r.rubros.find((x) => x.id === c.rubroId)?.nombre ?? "—"}</td><td className="text-zinc-500">{provs.find((x) => x.id === c.proveedorId)?.nombre ?? "—"}</td><td className="num">{ars(c.total)}</td><td className="num">{ars(c.pagado)}</td></tr>
            ))}
          </tbody>
        </table>
      </Section>

      {porProv.size > 0 && (
        <Section title="Compras por proveedor" className="mt-6">
          <table className="tbl"><tbody>{[...porProv.entries()].sort((a, b) => b[1] - a[1]).map(([pid, t]) => <tr key={pid}><td>{provs.find((x) => x.id === pid)?.nombre ?? "Sin proveedor"}</td><td className="num">{ars(t)}</td></tr>)}</tbody></table>
        </Section>
      )}
    </>
  );
}
