import { and, desc, eq, inArray } from "drizzle-orm";
import { requireObra } from "@/lib/access";
import { db, schema } from "@/lib/db";
import { Badge, Empty, Field, PageHeader, Section } from "@/components/ui";
import { ActionForm } from "@/components/forms/form-state";
import { ActionButton, ConfirmAction } from "@/components/client";
import { cambiarVisibilidadDocumento, eliminarDocumento, subirDocumento } from "@/app/actions/comunicacion";
import { fechaHora } from "@/lib/format";
import { ArchivoInput } from "@/components/archivo-input";

const CATS = { plano: "Planos", contrato: "Contratos y legales", foto: "Fotos", general: "General" } as const;

export default async function Documentos({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { rol } = await requireObra(id);
  const filtros = [eq(schema.documentos.obraId, id)];
  if (rol === "cliente") filtros.push(eq(schema.documentos.visibleCliente, true));
  if (rol === "obrero") filtros.push(eq(schema.documentos.visibleObrero, true));
  const docs = await db.query.documentos.findMany({ where: and(...filtros), orderBy: desc(schema.documentos.createdAt) });
  const autores = docs.length ? await db.query.users.findMany({ where: inArray(schema.users.id, [...new Set(docs.map((d) => d.subidoPor))]) }) : [];
  const esArq = rol === "arquitecto";
  return (
    <>
      <PageHeader title="Documentación" subtitle={esArq ? "Planos, contratos, fotos y archivos de la obra. Elegí qué ve el cliente y qué ve el equipo de obra." : "Documentos compartidos por el arquitecto."} />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className={`space-y-6 ${esArq ? "lg:col-span-2" : "lg:col-span-3"}`}>
          {docs.length === 0 && <Empty title="No hay documentos" />}
          {(Object.keys(CATS) as (keyof typeof CATS)[]).map((cat) => {
            const ds = docs.filter((d) => (d.categoria in CATS ? d.categoria : "general") === cat);
            if (!ds.length) return null;
            return (
              <Section key={cat} title={`${CATS[cat]} (${ds.length})`}>
                {cat === "foto" ? (
                  <div className="grid grid-cols-3 gap-2 p-4 sm:grid-cols-5">
                    {ds.map((d) => (
                      <a key={d.id} href={`/api/archivos/${d.id}`} target="_blank" className="aspect-square overflow-hidden rounded-lg bg-zinc-100" title={`${d.nombre} · ${fechaHora(d.createdAt)}`}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={`/api/archivos/${d.id}`} alt={d.nombre} className="h-full w-full object-cover" />
                      </a>
                    ))}
                  </div>
                ) : (
                  <table className="tbl">
                    <tbody>
                      {ds.map((d) => (
                        <tr key={d.id}>
                          <td><a href={`/api/archivos/${d.id}`} target="_blank" className="font-medium hover:underline">{d.nombre}</a><div className="text-xs text-zinc-400">{autores.find((a) => a.id === d.subidoPor)?.nombre} · {fechaHora(d.createdAt)} · {d.tamano ? `${Math.round(d.tamano / 1024)} KB` : ""}</div></td>
                          {esArq && (
                            <td className="whitespace-nowrap text-right">
                              <ActionButton action={cambiarVisibilidadDocumento.bind(null, d.id, "visibleCliente", !d.visibleCliente)} className="btn-ghost btn-sm">{d.visibleCliente ? <Badge tono="verde">Cliente ✓</Badge> : <Badge>Cliente ✗</Badge>}</ActionButton>
                              <ActionButton action={cambiarVisibilidadDocumento.bind(null, d.id, "visibleObrero", !d.visibleObrero)} className="btn-ghost btn-sm">{d.visibleObrero ? <Badge tono="verde">Obra ✓</Badge> : <Badge>Obra ✗</Badge>}</ActionButton>
                              <ConfirmAction action={eliminarDocumento.bind(null, d.id)} label="×" className="btn-ghost btn-sm text-zinc-400" title={`¿Eliminar ${d.nombre}?`} />
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </Section>
            );
          })}
        </div>
        {esArq && (
          <div className="card card-pad h-fit">
            <div className="h2 mb-3">Subir documentos</div>
            <ActionForm action={subirDocumento.bind(null, id)} resetOnOk submitLabel="Subir">
              <div className="space-y-3">
                <ArchivoInput name="archivos" multiple required />
                <Field label="Categoría"><select name="categoria" className="input"><option value="plano">Plano</option><option value="contrato">Contrato / legal</option><option value="foto">Foto</option><option value="general">General</option></select></Field>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="visibleCliente" defaultChecked /> Visible para el cliente</label>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="visibleObrero" defaultChecked /> Visible para el equipo de obra</label>
              </div>
            </ActionForm>
          </div>
        )}
      </div>
    </>
  );
}
