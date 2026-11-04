import { desc, eq, inArray } from "drizzle-orm";
import { requireObra } from "@/lib/access";
import { resumenObra } from "@/lib/queries";
import { db, schema } from "@/lib/db";
import { Badge, Field, PageHeader, Progress, Section, Stat } from "@/components/ui";
import { ActionForm } from "@/components/forms/form-state";
import { registrarAvance } from "@/app/actions/obra";
import { ArchivoInput } from "@/components/archivo-input";
import { avancePrevistoItem, cantidadDe } from "@/lib/engine/calculos";
import { fechaCorta, fechaLarga, habilesEntre, hoyISO } from "@/lib/engine/calendario";
import { fechaHora, num, pct } from "@/lib/format";

export default async function Seguimiento({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ problema?: string; item?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const { rol, miembroId } = await requireObra(id);
  const r = await resumenObra(id);
  const hoy = hoyISO();
  const puedeInformar = rol !== "cliente";
  const avances = await db.query.avances.findMany({ where: eq(schema.avances.obraId, id), orderBy: desc(schema.avances.createdAt), limit: 40 });
  const autores = avances.length ? await db.query.users.findMany({ where: inArray(schema.users.id, [...new Set(avances.map((a) => a.autorId))]) }) : [];
  const nombreItem = new Map(r.items.map((i) => [i.id, i.nombre]));
  const visibles = rol === "cliente" ? avances.filter((a) => a.tipo === "avance") : avances;
  const tareasForm = r.items.filter((i) => !i.esHito && (rol === "arquitecto" || !i.asignadoA || i.asignadoA === miembroId)).filter((i) => i.avanceReal < 100 || rol === "arquitecto");
  const enCurso = tareasForm.filter((i) => i.inicio && i.inicio <= hoy);

  return (
    <>
      <PageHeader title={rol === "obrero" ? "Mis tareas y avances" : rol === "cliente" ? "Avances de la obra" : "Seguimiento de producción"} subtitle="Planificación original comparada con la evolución real de la obra." />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Avance real" value={pct(r.avance.real, 0)} tone={r.avance.desvio < -10 ? "bad" : r.avance.desvio < -3 ? "warn" : "ok"} />
        <Stat label="Avance previsto" value={pct(r.avance.previsto, 0)} hint={`Desvío ${r.avance.desvio >= 0 ? "+" : ""}${r.avance.desvio.toFixed(1)} pts`} />
        <Stat label="Tareas atrasadas" value={r.atrasados.length} tone={r.atrasados.length ? "bad" : "ok"} />
        <Stat label="Tareas pendientes" value={r.items.filter((i) => !i.esHito && i.avanceReal < 100).length} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Section title="Avance por rubro y tarea">
            <div className="overflow-x-auto">
              <table className="tbl">
                <thead><tr><th>Tarea</th><th>Período</th><th className="num">Ejecutado</th><th className="w-44">Real / previsto</th><th>Estado</th></tr></thead>
                <tbody>
                  {r.rubros.map((rb) => {
                    const its = r.items.filter((i) => i.rubroId === rb.id && !i.esHito);
                    if (!its.length) return null;
                    const peso = (i: (typeof its)[0]) => Math.max(1, i.duracion);
                    const tot = its.reduce((a, i) => a + peso(i), 0);
                    const real = its.reduce((a, i) => a + peso(i) * i.avanceReal, 0) / tot;
                    const prev = its.reduce((a, i) => a + peso(i) * avancePrevistoItem(i, hoy), 0) / tot;
                    return [
                      <tr key={rb.id} className="bg-zinc-50/70">
                        <td className="font-medium">{rb.codigo} {rb.nombre}</td><td /><td />
                        <td><Progress value={real} previsto={prev} small /><div className="mt-0.5 text-[11px] text-zinc-500">{real.toFixed(0)}% / {prev.toFixed(0)}%</div></td><td />
                      </tr>,
                      ...its.map((i) => {
                        const prevI = avancePrevistoItem(i, hoy);
                        const atraso = r.atrasados.find((a) => a.item.id === i.id);
                        return (
                          <tr key={i.id}>
                            <td className="pl-8">{rol !== "cliente" ? <a href={`/obras/${id}/tarea/${i.id}`} className="hover:underline">{i.nombre}</a> : i.nombre}</td>
                            <td className="whitespace-nowrap text-xs text-zinc-500">{fechaCorta(i.inicio)} → {fechaCorta(i.fin)}</td>
                            <td className="num text-xs">{i.cantidadEjecutada ? `${num(i.cantidadEjecutada)} / ` : ""}{num(cantidadDe(i))} {i.unidad}</td>
                            <td><Progress value={i.avanceReal} previsto={prevI} small /><div className="mt-0.5 text-[11px] text-zinc-500">{i.avanceReal.toFixed(0)}% / {prevI.toFixed(0)}%</div></td>
                            <td>
                              {i.avanceReal >= 100 ? <Badge tono="verde">Terminada</Badge> : atraso ? <Badge tono="rojo">{atraso.diasAtraso ? `${atraso.diasAtraso} d atraso` : "Atrasada"}</Badge> : i.inicio && i.inicio <= hoy ? <Badge tono="azul">En curso</Badge> : <Badge>Por iniciar{i.inicio ? ` en ${habilesEntre(hoy, i.inicio)} d` : ""}</Badge>}
                            </td>
                          </tr>
                        );
                      }),
                    ];
                  })}
                </tbody>
              </table>
            </div>
          </Section>
        </div>

        <div className="space-y-6">
          {puedeInformar && (
            <div className="card card-pad" id="informar">
              <div className="h2 mb-3">{sp.problema ? "Informar un problema" : "Informar avance"}</div>
              <ActionForm action={registrarAvance.bind(null, id)} resetOnOk submitLabel={sp.problema ? "Enviar al arquitecto" : "Registrar avance"}>
                <input type="hidden" name="tipo" value={sp.problema ? "problema" : "avance"} />
                <div className="space-y-3">
                  <Field label="Tarea">
                    <select name="itemId" className="input" required defaultValue={sp.item ?? enCurso[0]?.id ?? ""}>
                      <option value="" disabled>Elegí la tarea…</option>
                      {tareasForm.map((i) => <option key={i.id} value={i.id}>{i.nombre} ({i.avanceReal}%)</option>)}
                    </select>
                  </Field>
                  {!sp.problema && (
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Avance total de la tarea (%)"><input name="avancePct" type="number" min="0" max="100" step="5" className="input" required /></Field>
                      <Field label="Cantidad ejecutada hoy"><input name="cantidad" className="input" inputMode="decimal" placeholder="opcional" /></Field>
                    </div>
                  )}
                  <Field label={sp.problema ? "¿Qué pasó? *" : "Observaciones"}><textarea name="nota" rows={3} className="input" required={!!sp.problema} placeholder={sp.problema ? "Ej.: falta material, lluvia, interferencia con instalación…" : ""} /></Field>
                  <Field label="Fotos"><ArchivoInput name="fotos" accept="image/*" multiple /></Field>
                </div>
              </ActionForm>
              <div className="mt-3 text-xs">
                {sp.problema ? <a href="?" className="text-brand-700 hover:underline">Informar avance en cambio</a> : <a href="?problema=1" className="text-brand-700 hover:underline">Informar un problema o imprevisto</a>}
              </div>
            </div>
          )}

          <Section title="Registro de avances">
            <ul className="divide-y divide-zinc-100">
              {visibles.length === 0 && <li className="muted p-5">Todavía no hay avances registrados.</li>}
              {visibles.map((a) => (
                <li key={a.id} className="px-5 py-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{nombreItem.get(a.itemId)}</span>
                    {a.tipo === "problema" ? <Badge tono="rojo">Problema</Badge> : <Badge tono="verde">{a.avancePct}%</Badge>}
                  </div>
                  {a.nota && <p className="mt-1 text-zinc-700">{a.nota}</p>}
                  {a.fotos.length > 0 && (
                    <div className="mt-2 flex gap-1.5">
                      {a.fotos.map((f) => (
                        <a key={f} href={`/api/archivos/${f}`} target="_blank" className="h-14 w-14 overflow-hidden rounded bg-zinc-100">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={`/api/archivos/${f}`} alt="" className="h-full w-full object-cover" />
                        </a>
                      ))}
                    </div>
                  )}
                  <div className="mt-1 text-xs text-zinc-400">{autores.find((u) => u.id === a.autorId)?.nombre} · {fechaHora(a.createdAt)}</div>
                </li>
              ))}
            </ul>
          </Section>
        </div>
      </div>
      <p className="mt-4 text-xs text-zinc-400">Hoy: {fechaLarga(hoy)}. En las barras, la línea negra marca el avance previsto a la fecha.</p>
    </>
  );
}
