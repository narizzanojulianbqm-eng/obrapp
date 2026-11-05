import Link from "next/link";
import { and, eq, like, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { requireObra } from "@/lib/access";
import { cargarObra } from "@/lib/obra-service";
import { PageHeader } from "@/components/ui";
import { ConfirmAction, InlineNumber, InlineText } from "@/components/client";
import { setNombreItem, setCantidadManual, setDuracionManual, crearItem, crearRubro, eliminarItem, eliminarRubro, renombrarRubro } from "@/app/actions/obra";
import { FORMULAS } from "@/lib/engine/plantillas";
import { fechaCorta } from "@/lib/engine/calendario";
import { num } from "@/lib/format";
import { AsignarSelect, DependenciasEditor } from "./rubros-client";
import { CargarDesdeArchivo } from "@/components/cargar-desde-archivo";
import { aiDisponible } from "@/lib/ai";
import { modoDemo } from "@/lib/entorno";
import { SubmitButton } from "@/components/client";

export default async function Rubros({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ importar?: string }> }) {
  const { id } = await params;
  const { importar } = await searchParams;
  const { obra } = await requireObra(id, ["arquitecto"]);
  const { rubros, items, miembros } = await cargarObra(id);
  const comentarios = await db.select({ canal: schema.mensajes.canal, n: sql<number>`count(*)` }).from(schema.mensajes).where(and(eq(schema.mensajes.obraId, id), like(schema.mensajes.canal, "item:%"))).groupBy(schema.mensajes.canal);
  const nCom = new Map(comentarios.map((c) => [c.canal.slice(5), Number(c.n)]));
  const nombres = new Map(items.map((i) => [i.id, i.nombre]));
  const opciones = items.map((i) => ({ id: i.id, nombre: i.nombre }));
  const obreros = miembros.filter((m) => m.rol === "obrero").map((m) => ({ id: m.id, nombre: m.nombre ?? m.email }));
  return (
    <>
      <PageHeader actions={<><a href={`/api/obras/${id}/excel`} className="btn-secondary">Exportar a Excel</a></>} title="Rubros y tareas" subtitle="Generados desde la plantilla según el tipo de obra y el sistema constructivo. Editá cantidades (la manual prevalece sobre la calculada), duraciones, responsables y dependencias: el cómputo, el presupuesto y el Gantt se actualizan solos." />
      <div className="space-y-5">
        <CargarDesdeArchivo obraId={id} iaDisponible={aiDisponible()} abiertoInicial={importar === "1" || importar === "nueva"} modoInicial={importar === "nueva" ? "reemplazar" : "agregar"} demo={modoDemo() && obra.nombre.endsWith("(DEMO)")} />
        {rubros.map((r) => {
          const its = items.filter((i) => i.rubroId === r.id);
          return (
            <section key={r.id} className="card overflow-hidden">
              <div className="flex items-center gap-3 border-b border-zinc-100 bg-zinc-50/60 px-4 py-2.5">
                <span className="w-7 text-sm font-semibold text-zinc-400">{r.codigo}</span>
                <div className="flex-1"><InlineText value={r.nombre} onSave={renombrarRubro.bind(null, r.id)} className="w-full max-w-sm rounded border border-transparent bg-transparent px-1 py-0.5 text-sm font-semibold hover:border-zinc-300 focus:border-brand-500 focus:outline-none" /></div>
                <ConfirmAction action={eliminarRubro.bind(null, r.id)} label="Eliminar rubro" className="btn-ghost btn-sm text-zinc-400" title={`¿Eliminar el rubro "${r.nombre}"?`} message={`Se eliminan sus ${its.length} ítems con sus análisis de precios y avances.`} />
              </div>
              <div className="overflow-x-auto">
                <table className="tbl">
                  <thead>
                    <tr><th className="w-14">Ítem</th><th>Descripción</th><th>Un.</th><th className="num">Cantidad</th><th className="num">Duración</th><th>Período</th><th>Responsable</th><th>Dependencias</th><th /></tr>
                  </thead>
                  <tbody>
                    {its.map((i, idx) => (
                      <tr key={i.id} className="align-top">
                        <td className="pt-3 text-xs text-zinc-400">{r.codigo}.{String(idx + 1).padStart(2, "0")}</td>
                        <td className="min-w-[16rem]">
                          <InlineText value={i.nombre} onSave={setNombreItem.bind(null, i.id)} className="w-full rounded border border-transparent px-1 py-0.5 hover:border-zinc-300 focus:border-brand-500 focus:outline-none" />
                          {i.esHito && <span className="ml-1 text-xs text-amber-700">◆ hito</span>}
                          <Link href={`/obras/${id}/tarea/${i.id}`} className="ml-1 text-xs text-zinc-400 hover:text-brand-700">💬 {nCom.get(i.id) ?? ""} ficha</Link>
                        </td>
                        <td className="pt-3 text-zinc-500">{i.esHito ? "—" : i.unidad}</td>
                        <td className="num">
                          {!i.esHito && (
                            <>
                              <InlineNumber value={i.cantidadManual} placeholder={num(i.cantidadCalc)} onSave={setCantidadManual.bind(null, i.id)} />
                              <div className="mt-0.5 text-[11px] text-zinc-400" title={i.formula ? FORMULAS[i.formula]?.label : "Cantidad manual"}>
                                {i.cantidadManual != null ? `calc. ${num(i.cantidadCalc)}` : i.formula ? FORMULAS[i.formula]?.label : ""}
                              </div>
                            </>
                          )}
                        </td>
                        <td className="num">
                          {!i.esHito && (
                            <>
                              <InlineNumber value={i.duracionManual} placeholder={String(i.duracion)} className="input-sm w-16 text-right" onSave={setDuracionManual.bind(null, i.id)} />
                              <div className="mt-0.5 text-[11px] text-zinc-400">{i.duracionManual ? "manual" : `${num(i.hhPorUnidad)} hh/${i.unidad}`}</div>
                            </>
                          )}
                        </td>
                        <td className="whitespace-nowrap pt-3 text-xs text-zinc-600">{fechaCorta(i.inicio)}{!i.esHito && ` → ${fechaCorta(i.fin)}`}</td>
                        <td>{!i.esHito && <AsignarSelect itemId={i.id} value={i.asignadoA} miembros={obreros} />}</td>
                        <td className="pt-2.5">
                          <DependenciasEditor itemId={i.id} duracionManual={!!i.duracionManual} opciones={opciones} preds={(i.predecesoras ?? []).map((p) => ({ ...p, nombre: nombres.get(p.id) ?? "?" }))} />
                        </td>
                        <td className="pt-2 text-right">
                          <ConfirmAction action={eliminarItem.bind(null, i.id)} label="×" className="btn-ghost btn-sm text-zinc-400" title={`¿Eliminar "${i.nombre}"?`} message="Las tareas que dependían de esta heredan sus dependencias." />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <form action={crearItem.bind(null, r.id)} className="flex flex-wrap items-center gap-2 border-t border-zinc-100 px-4 py-2.5">
                <input name="nombre" className="input-sm min-w-[14rem] flex-1" placeholder="Nueva tarea en este rubro…" required />
                <input name="unidad" className="input-sm w-20" placeholder="Unidad" defaultValue="gl" />
                <input name="cantidad" className="input-sm w-24" placeholder="Cantidad" inputMode="decimal" />
                <input name="duracion" className="input-sm w-24" placeholder="Días" inputMode="numeric" />
                <SubmitButton className="btn-secondary btn-sm" pendingText="…">Agregar</SubmitButton>
              </form>
            </section>
          );
        })}
        <form action={crearRubro.bind(null, id)} className="card flex items-center gap-2 p-4">
          <input name="nombre" className="input flex-1" placeholder="Nuevo rubro (ej. Piscina, Parquización, Ascensor…)" required />
          <SubmitButton className="btn-secondary">Agregar rubro</SubmitButton>
        </form>
      </div>
    </>
  );
}
