import { desc, eq, inArray } from "drizzle-orm";
import { requireObra } from "@/lib/access";
import { resumenObra } from "@/lib/queries";
import { db, schema } from "@/lib/db";
import { ars, num, pct } from "@/lib/format";
import { fechaLarga, hoyISO } from "@/lib/engine/calendario";
import { finDeObra, avancePrevistoItem } from "@/lib/engine/calculos";
import { SISTEMAS, TIPOS_OBRA } from "@/lib/engine/plantillas";
import { PrintButton } from "./print";

export default async function Reporte({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tipo?: string }> }) {
  const { id } = await params;
  const { tipo = "avance" } = await searchParams;
  const { rol } = await requireObra(id, ["arquitecto", "cliente"]);
  const r = await resumenObra(id);
  const { obra, presupuesto: p } = r;
  const hoy = hoyISO();
  const esArq = rol === "arquitecto";
  const coef = esArq ? 1 : p.coeficienteResumen;
  const avances = await db.query.avances.findMany({ where: eq(schema.avances.obraId, id), orderBy: desc(schema.avances.createdAt), limit: 12 });
  const fotos = avances.flatMap((a) => a.fotos).slice(0, 6);
  const docsFotos = fotos.length ? await db.query.documentos.findMany({ where: inArray(schema.documentos.id, fotos) }) : [];
  const visibles = fotos.filter((f) => esArq || docsFotos.find((d) => d.id === f)?.visibleCliente);

  return (
    <div className="mx-auto max-w-4xl bg-white p-8 print:p-0">
      <div className="mb-6 flex items-center justify-between print:hidden">
        <div className="flex gap-2">
          <a href="?tipo=avance" className={tipo === "avance" ? "btn-primary btn-sm" : "btn-secondary btn-sm"}>Reporte de avance</a>
          <a href="?tipo=presupuesto" className={tipo === "presupuesto" ? "btn-primary btn-sm" : "btn-secondary btn-sm"}>Presupuesto</a>
        </div>
        <PrintButton />
      </div>
      <header className="border-b border-zinc-300 pb-4">
        <div className="text-xs uppercase tracking-wider text-zinc-500">{tipo === "avance" ? "Reporte de avance de obra" : "Presupuesto de obra"} · {fechaLarga(hoy)}</div>
        <h1 className="mt-1 text-2xl font-semibold">{obra.nombre}</h1>
        <div className="mt-1 text-sm text-zinc-600">{[obra.direccion, obra.localidad, obra.provincia].filter(Boolean).join(", ")} · {TIPOS_OBRA[obra.tipo as keyof typeof TIPOS_OBRA]} · {SISTEMAS[obra.sistema as keyof typeof SISTEMAS]} · {num(obra.supCubierta, 1)} m²</div>
        <div className="mt-1 text-sm text-zinc-600">Comitente: {obra.clienteNombre ?? "—"} · Dirección de obra: {obra.arquitectoResponsable ?? "—"}</div>
      </header>

      {tipo === "avance" ? (
        <>
          <section className="mt-6 grid grid-cols-4 gap-4 text-center">
            {[["Avance real", pct(r.avance.real, 0)], ["Avance previsto", pct(r.avance.previsto, 0)], ["Inicio", fechaLarga(obra.fechaInicio)], ["Fin estimado", fechaLarga(finDeObra(r.items))]].map(([l, v]) => (
              <div key={l} className="rounded-lg border border-zinc-200 p-3"><div className="text-xs text-zinc-500">{l}</div><div className="mt-1 text-lg font-semibold">{v}</div></div>
            ))}
          </section>
          <section className="mt-6">
            <h2 className="mb-2 font-semibold">Avance por rubro</h2>
            <table className="tbl">
              <thead><tr><th>Rubro</th><th className="num">Real</th><th className="num">Previsto</th><th>Período</th></tr></thead>
              <tbody>
                {r.rubros.map((rb) => {
                  const its = r.items.filter((i) => i.rubroId === rb.id && !i.esHito);
                  if (!its.length) return null;
                  const w = (i: (typeof its)[0]) => Math.max(1, i.duracion);
                  const tot = its.reduce((a, i) => a + w(i), 0);
                  const ini = its.reduce((m, i) => (i.inicio && i.inicio < m ? i.inicio : m), "9999");
                  const fin = its.reduce((m, i) => (i.fin && i.fin > m ? i.fin : m), "");
                  return <tr key={rb.id}><td>{rb.codigo} {rb.nombre}</td><td className="num">{(its.reduce((a, i) => a + w(i) * i.avanceReal, 0) / tot).toFixed(0)}%</td><td className="num">{(its.reduce((a, i) => a + w(i) * avancePrevistoItem(i, hoy), 0) / tot).toFixed(0)}%</td><td className="text-xs">{fechaLarga(ini)} – {fechaLarga(fin)}</td></tr>;
                })}
              </tbody>
            </table>
          </section>
          {r.atrasados.length > 0 && <section className="mt-6"><h2 className="mb-2 font-semibold">Tareas demoradas</h2><ul className="list-disc pl-5 text-sm">{r.atrasados.map((a) => <li key={a.item.id}>{a.item.nombre}: {a.item.avanceReal}% real vs {a.previsto.toFixed(0)}% previsto</li>)}</ul></section>}
          {esArq && <section className="mt-6"><h2 className="mb-2 font-semibold">Economía</h2><p className="text-sm">Presupuesto: {ars(p.total)} · Ejecutado: {ars(r.reales.total)} · Pagado: {ars(r.reales.pagado)}</p></section>}
          {visibles.length > 0 && (
            <section className="mt-6 break-inside-avoid">
              <h2 className="mb-2 font-semibold">Registro fotográfico</h2>
              <div className="grid grid-cols-3 gap-2">{visibles.map((f) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={f} src={`/api/archivos/${f}`} alt="" className="aspect-[4/3] w-full rounded object-cover" />
              ))}</div>
            </section>
          )}
        </>
      ) : (
        <section className="mt-6">
          <table className="tbl">
            <thead><tr><th>Ítem</th><th>Descripción</th><th>Un.</th><th className="num">Cant.</th>{(esArq || obra.clientePuedeVerDetalle) && <th className="num">P. unit.</th>}<th className="num">Importe</th></tr></thead>
            <tbody>
              {p.rubros.map((x) => [
                <tr key={x.rubro.id} className="bg-zinc-50 font-medium"><td>{x.rubro.codigo}</td><td colSpan={(esArq || obra.clientePuedeVerDetalle) ? 4 : 3}>{x.rubro.nombre}</td><td className="num">{ars(x.subtotal * coef)}</td></tr>,
                ...((esArq || obra.clientePuedeVerDetalle) ? x.items.map((it, k) => <tr key={it.item.id}><td className="text-xs">{x.rubro.codigo}.{String(k + 1).padStart(2, "0")}</td><td>{it.item.nombre}</td><td>{it.item.unidad}</td><td className="num">{num(it.cantidad)}</td><td className="num">{ars(it.apu.unitario * coef, 2)}</td><td className="num">{ars(it.parcial * coef)}</td></tr>) : []),
              ])}
            </tbody>
          </table>
          <table className="tbl mt-4 ml-auto w-80">
            <tbody>
              {esArq && <>
                <tr><td>Costo directo</td><td className="num">{ars(p.costoDirecto)}</td></tr>
                <tr><td>Gastos generales ({obra.gastosGeneralesPct}%)</td><td className="num">{ars(p.gastosGenerales)}</td></tr>
                <tr><td>Beneficio ({obra.beneficioPct}%)</td><td className="num">{ars(p.beneficio)}</td></tr>
                <tr><td>Honorarios ({obra.honorariosPct}%)</td><td className="num">{ars(p.honorarios)}</td></tr>
                {p.iva > 0 && <tr><td>IVA ({obra.ivaPct}%)</td><td className="num">{ars(p.iva)}</td></tr>}
              </>}
              <tr className="text-base font-semibold"><td>Total</td><td className="num">{ars(p.total)}</td></tr>
            </tbody>
          </table>
          {p.faltanPrecios > 0 && <p className="mt-4 text-xs text-amber-700">Atención: {p.faltanPrecios} insumos sin precio; importes incompletos.</p>}
        </section>
      )}
      <footer className="mt-10 border-t border-zinc-200 pt-3 text-xs text-zinc-400">Generado con Obrapp · {obra.codigo}</footer>
    </div>
  );
}
