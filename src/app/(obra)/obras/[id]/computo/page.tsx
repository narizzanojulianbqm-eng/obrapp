import Link from "next/link";
import { requireObra } from "@/lib/access";
import { cargarObra } from "@/lib/obra-service";
import { computoMateriales } from "@/lib/engine/calculos";
import { PageHeader, Section, Badge } from "@/components/ui";
import { ars, num } from "@/lib/format";

const TIPO = { material: "Materiales", mano_obra: "Mano de obra", equipo: "Equipos y herramientas" } as const;

export default async function Computo({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { rol } = await requireObra(id, ["arquitecto", "obrero"]);
  const { items, recursos, insumos } = await cargarObra(id);
  const filas = computoMateriales(items, recursos, insumos);
  const verPrecios = rol === "arquitecto";
  const grupos = (["material", "mano_obra", "equipo"] as const).filter((t) => verPrecios || t === "material");
  return (
    <>
      <PageHeader
        title={rol === "obrero" ? "Materiales de la obra" : "Cómputo de materiales"}
        subtitle="Cantidades totales que surgen de multiplicar la cantidad de cada ítem por su consumo unitario (incluye desperdicio). Se actualiza al cambiar rubros, cantidades o parámetros."
        actions={verPrecios && <><Link href={`/obras/${id}/cotizaciones`} className="btn-secondary">Pedir cotización</Link><Link href={`/obras/${id}/precios`} className="btn-primary">Cargar precios</Link></>}
      />
      <div className="space-y-6">
        {grupos.map((t) => {
          const fs = filas.filter((f) => f.insumo.tipo === t);
          const total = fs.reduce((a, f) => a + f.total, 0);
          return (
            <Section key={t} title={`${TIPO[t]} (${fs.length})`} actions={verPrecios && <span className="text-sm font-medium tabular-nums">{ars(total)}</span>}>
              <div className="overflow-x-auto">
                <table className="tbl">
                  <thead><tr><th>Insumo</th><th>Unidad</th><th className="num">Cantidad</th>{verPrecios && <><th className="num">Precio unit.</th><th className="num">Total</th></>}<th>Se usa en</th></tr></thead>
                  <tbody>
                    {fs.map((f) => (
                      <tr key={f.insumo.id}>
                        <td className="font-medium">{f.insumo.nombre}</td>
                        <td className="text-zinc-500">{f.insumo.unidad}</td>
                        <td className="num font-medium">{num(f.cantidad)}</td>
                        {verPrecios && <><td className="num">{f.insumo.precio > 0 ? ars(f.insumo.precio, 2) : <Badge tono="ambar">sin precio</Badge>}</td><td className="num">{f.insumo.precio > 0 ? ars(f.total) : "—"}</td></>}
                        <td className="max-w-xs text-xs text-zinc-500">
                          <details><summary className="cursor-pointer">{f.usos.length} ítem{f.usos.length > 1 ? "s" : ""}</summary>
                            <ul className="mt-1 space-y-0.5">{f.usos.map((u) => <li key={u.itemId}>{u.nombre}: {num(u.cantidad)}</li>)}</ul>
                          </details>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>
          );
        })}
      </div>
    </>
  );
}
