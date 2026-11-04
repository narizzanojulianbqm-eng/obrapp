import { and, eq, ne } from "drizzle-orm";
import { requireObra } from "@/lib/access";
import { cargarObra } from "@/lib/obra-service";
import { analisisPrecios, cantidadDe } from "@/lib/engine/calculos";
import { db, schema } from "@/lib/db";
import { Badge, Field, PageHeader, Section } from "@/components/ui";
import { InlineNumber, SubmitButton, ActionButton } from "@/components/client";
import { actualizarConsumo, actualizarPrecio, agregarRecurso, copiarPreciosDe, crearInsumo } from "@/app/actions/obra";
import { ars, num } from "@/lib/format";

const TIPO = { material: "Material", mano_obra: "Mano de obra", equipo: "Equipo" } as const;

export default async function Precios({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ vista?: string }> }) {
  const { id } = await params;
  const { vista = "insumos" } = await searchParams;
  const { obra } = await requireObra(id, ["arquitecto"]);
  const { rubros, items, insumos, recursos } = await cargarObra(id);
  const mapa = new Map(insumos.map((i) => [i.id, i]));
  const usados = new Set(recursos.map((r) => r.insumoId));
  const otras = await db.query.obras.findMany({ where: and(eq(schema.obras.ownerId, obra.ownerId), ne(schema.obras.id, id)) });
  const sinPrecio = insumos.filter((i) => usados.has(i.id) && i.precio <= 0).length;

  return (
    <>
      <PageHeader
        title="Análisis de precios"
        subtitle="Cargá el precio de cada insumo una sola vez: los análisis de precios unitarios, el presupuesto y el cómputo valorizado se recalculan solos. La plataforma no inventa precios de mercado."
      />
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <a href="?vista=insumos" className={vista === "insumos" ? "btn-primary btn-sm" : "btn-secondary btn-sm"}>Lista de precios de insumos</a>
        <a href="?vista=apu" className={vista === "apu" ? "btn-primary btn-sm" : "btn-secondary btn-sm"}>Análisis por ítem</a>
        {sinPrecio > 0 && <Badge tono="ambar">{sinPrecio} insumos sin precio</Badge>}
        {otras.length > 0 && (
          <div className="ml-auto flex items-center gap-2 text-xs text-zinc-500">
            Copiar precios de:
            {otras.slice(0, 4).map((o) => <ActionButton key={o.id} action={copiarPreciosDe.bind(null, id, o.id)}>{o.nombre}</ActionButton>)}
          </div>
        )}
      </div>

      {vista === "insumos" ? (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            {(["material", "mano_obra", "equipo"] as const).map((t) => (
              <Section key={t} title={TIPO[t] === "Material" ? "Materiales" : TIPO[t] === "Equipo" ? "Equipos y herramientas" : "Mano de obra"}>
                <table className="tbl">
                  <thead><tr><th>Insumo</th><th>Unidad</th><th className="num">Precio unitario ($)</th><th>Actualizado</th></tr></thead>
                  <tbody>
                    {insumos.filter((i) => i.tipo === t).map((i) => (
                      <tr key={i.id} className={usados.has(i.id) ? "" : "opacity-50"}>
                        <td>{i.nombre}{!usados.has(i.id) && <span className="ml-1 text-xs text-zinc-400">(sin uso)</span>}</td>
                        <td className="text-zinc-500">{i.unidad}</td>
                        <td className="num"><InlineNumber value={i.precio || null} placeholder="0" className={`input-sm w-32 text-right ${i.precio <= 0 && usados.has(i.id) ? "border-amber-400 bg-amber-50" : ""}`} onSave={actualizarPrecio.bind(null, i.id)} /></td>
                        <td className="text-xs text-zinc-400">{i.precioActualizado ? i.precioActualizado.toLocaleDateString("es-AR") : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Section>
            ))}
          </div>
          <div className="card card-pad h-fit">
            <div className="h2 mb-3">Nuevo insumo</div>
            <form action={crearInsumo.bind(null, id)} className="space-y-3">
              <Field label="Nombre"><input name="nombre" className="input" required /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Unidad"><input name="unidad" className="input" required placeholder="m2, kg, h…" /></Field>
                <Field label="Tipo"><select name="tipo" className="input"><option value="material">Material</option><option value="mano_obra">Mano de obra</option><option value="equipo">Equipo</option></select></Field>
              </div>
              <Field label="Precio unitario"><input name="precio" className="input" inputMode="decimal" /></Field>
              <SubmitButton>Agregar insumo</SubmitButton>
            </form>
            <p className="mt-4 text-xs text-zinc-500">Tip: en Cotizaciones podés pedir precios a proveedores y actualizar esta lista con la oferta elegida.</p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {rubros.map((r) => (
            <Section key={r.id} title={`${r.codigo} ${r.nombre}`}>
              <div className="divide-y divide-zinc-100">
                {items.filter((i) => i.rubroId === r.id && !i.esHito).map((it) => {
                  const apu = analisisPrecios(it, recursos, mapa);
                  return (
                    <details key={it.id} className="group">
                      <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-6 gap-y-1 px-5 py-3 hover:bg-zinc-50">
                        <span className="min-w-[16rem] flex-1 text-sm font-medium">{it.nombre} <span className="font-normal text-zinc-400">· {num(cantidadDe(it))} {it.unidad}</span></span>
                        <span className="text-xs text-zinc-500">Mat {ars(apu.materiales)} · MO {ars(apu.manoObra)} · Eq {ars(apu.equipos)}</span>
                        <span className="w-32 text-right text-sm font-semibold tabular-nums">{ars(apu.unitario, 2)}/{it.unidad}</span>
                        {apu.faltanPrecios > 0 && <Badge tono="ambar">{apu.faltanPrecios} sin precio</Badge>}
                      </summary>
                      <div className="bg-zinc-50/60 px-5 pb-4">
                        <table className="tbl">
                          <thead><tr><th>Tipo</th><th>Insumo</th><th className="num">Consumo / {it.unidad}</th><th className="num">Precio</th><th className="num">Subtotal</th></tr></thead>
                          <tbody>
                            {apu.lineas.map((l) => (
                              <tr key={l.recursoId}>
                                <td className="text-xs text-zinc-500">{TIPO[l.tipo]}</td>
                                <td>{l.nombre}</td>
                                <td className="num"><InlineNumber value={l.consumo} onSave={actualizarConsumo.bind(null, l.recursoId)} /> <span className="text-xs text-zinc-400">{l.unidad}</span></td>
                                <td className="num">{l.precio > 0 ? ars(l.precio, 2) : <span className="text-amber-700">—</span>}</td>
                                <td className="num">{ars(l.subtotal, 2)}</td>
                              </tr>
                            ))}
                            <tr className="font-medium"><td colSpan={2}>Costo directo unitario · rendimiento {num(apu.hh)} hh/{it.unidad}</td><td /><td /><td className="num">{ars(apu.unitario, 2)}</td></tr>
                          </tbody>
                        </table>
                        <form action={agregarRecurso.bind(null, it.id)} className="mt-2 flex flex-wrap items-center gap-2">
                          <select name="insumoId" className="input-sm min-w-[16rem]" required defaultValue=""><option value="" disabled>Agregar insumo al análisis…</option>{insumos.map((i) => <option key={i.id} value={i.id}>{i.nombre} ({i.unidad})</option>)}</select>
                          <input name="consumo" className="input-sm w-24" placeholder="Consumo" inputMode="decimal" required />
                          <SubmitButton className="btn-secondary btn-sm" pendingText="…">Agregar</SubmitButton>
                          <span className="text-xs text-zinc-400">Para quitar un insumo, poné su consumo en 0.</span>
                        </form>
                      </div>
                    </details>
                  );
                })}
              </div>
            </Section>
          ))}
        </div>
      )}
    </>
  );
}
