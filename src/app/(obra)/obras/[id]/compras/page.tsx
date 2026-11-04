import { desc, eq } from "drizzle-orm";
import { requireObra } from "@/lib/access";
import { cargarObra } from "@/lib/obra-service";
import { db, schema } from "@/lib/db";
import { Badge, Empty, Estado, Field, PageHeader, Section, Stat } from "@/components/ui";
import { ActionForm } from "@/components/forms/form-state";
import { ActionButton, ConfirmAction } from "@/components/client";
import { aprobarCompraCliente, crearCompra, eliminarCompra, setEstadoCompra } from "@/app/actions/compras";
import { ars, num } from "@/lib/format";
import { hoyISO } from "@/lib/engine/calendario";

const SIGUIENTE = { prevista: "pedida", pedida: "recibida", recibida: "pagada", pagada: null } as const;
const LABEL = { pedida: "Marcar pedida", recibida: "Marcar recibida", pagada: "Marcar pagada" } as const;

export default async function Compras({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { rol, obra } = await requireObra(id, ["arquitecto", "cliente"]);
  const { rubros, insumos } = await cargarObra(id);
  const compras = await db.query.compras.findMany({ where: eq(schema.compras.obraId, id), orderBy: desc(schema.compras.createdAt) });
  const provs = await db.query.proveedores.findMany({ where: eq(schema.proveedores.ownerId, obra.ownerId) });
  const validas = compras.filter((c) => c.aprobacionCliente !== "rechazada");
  const total = validas.reduce((a, c) => a + c.total, 0);
  const pagado = validas.reduce((a, c) => a + c.pagado, 0);
  const previstas = validas.filter((c) => c.estado === "prevista" || c.estado === "pedida");
  const esArq = rol === "arquitecto";

  return (
    <>
      <PageHeader title={esArq ? "Compras" : "Compras y gastos"} subtitle={esArq ? "Cada compra impacta en los costos reales de su rubro." : "Gastos registrados en tu obra y compras que esperan tu aprobación."} />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Total comprado" value={ars(total)} />
        <Stat label="Pagado" value={ars(pagado)} />
        <Stat label="A pagar" value={ars(total - pagado)} tone={total - pagado > 0 ? "warn" : undefined} />
        <Stat label="Compras previstas / en curso" value={previstas.length} hint={ars(previstas.reduce((a, c) => a + c.total, 0))} />
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className={esArq ? "lg:col-span-2" : "lg:col-span-3"}>
          {compras.length === 0 ? <Empty title="Sin compras registradas" /> : (
            <Section title="Registro de compras">
              <div className="overflow-x-auto">
                <table className="tbl">
                  <thead><tr><th>Fecha</th><th>Descripción</th><th>Proveedor</th><th className="num">Cantidad</th><th className="num">Total</th><th>Estado</th><th /></tr></thead>
                  <tbody>
                    {compras.map((c) => {
                      const sig = SIGUIENTE[c.estado];
                      const bloqueada = c.requiereAprobacionCliente && c.aprobacionCliente !== "aprobada";
                      return (
                        <tr key={c.id} className={c.aprobacionCliente === "rechazada" ? "opacity-50" : ""}>
                          <td className="whitespace-nowrap text-xs">{c.fecha}</td>
                          <td><div>{c.descripcion}</div><div className="text-xs text-zinc-400">{rubros.find((r) => r.id === c.rubroId)?.nombre ?? ""}</div></td>
                          <td className="text-zinc-600">{provs.find((p) => p.id === c.proveedorId)?.nombre ?? "—"}</td>
                          <td className="num">{num(c.cantidad)} {c.unidad}</td>
                          <td className="num">{ars(c.total)}</td>
                          <td>
                            <div className="flex flex-col items-start gap-1">
                              <Estado e={c.estado} />
                              {c.requiereAprobacionCliente && <Badge tono={c.aprobacionCliente === "aprobada" ? "verde" : c.aprobacionCliente === "rechazada" ? "rojo" : "ambar"}>Cliente: {c.aprobacionCliente}</Badge>}
                            </div>
                          </td>
                          <td className="whitespace-nowrap text-right">
                            {esArq && sig && !bloqueada && <ActionButton action={setEstadoCompra.bind(null, c.id, sig)}>{LABEL[sig]}</ActionButton>}
                            {esArq && <ConfirmAction action={eliminarCompra.bind(null, c.id)} label="×" className="btn-ghost btn-sm text-zinc-400" title="¿Eliminar la compra?" message="Se descuenta de los costos reales de la obra." />}
                            {!esArq && c.aprobacionCliente === "pendiente" && (
                              <div className="flex gap-1.5">
                                <ConfirmAction action={aprobarCompraCliente.bind(null, c.id, true)} label="Aprobar" className="btn-primary btn-sm" title={`¿Aprobar la compra de ${c.descripcion} por ${ars(c.total)}?`} confirmLabel="Aprobar" />
                                <ConfirmAction action={aprobarCompraCliente.bind(null, c.id, false)} label="Rechazar" title="¿Rechazar la compra?" confirmLabel="Rechazar" />
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Section>
          )}
        </div>
        {esArq && (
          <div className="card card-pad h-fit">
            <div className="h2 mb-3">Registrar compra o gasto</div>
            <ActionForm action={crearCompra.bind(null, id)} resetOnOk submitLabel="Registrar">
              <div className="space-y-3">
                <Field label="Descripción *"><input name="descripcion" className="input" required list="ins-compras" /></Field>
                <datalist id="ins-compras">{insumos.map((i) => <option key={i.id} value={i.nombre} />)}</datalist>
                <div className="grid grid-cols-3 gap-2">
                  <Field label="Cantidad"><input name="cantidad" className="input" inputMode="decimal" defaultValue="1" /></Field>
                  <Field label="Unidad"><input name="unidad" className="input" defaultValue="u" /></Field>
                  <Field label="P. unit. *"><input name="precioUnitario" className="input" inputMode="decimal" required /></Field>
                </div>
                <Field label="Rubro"><select name="rubroId" className="input" defaultValue=""><option value="">—</option>{rubros.map((r) => <option key={r.id} value={r.id}>{r.codigo} {r.nombre}</option>)}</select></Field>
                <Field label="Proveedor"><select name="proveedorId" className="input" defaultValue=""><option value="">—</option>{provs.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}</select></Field>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Fecha"><input type="date" name="fecha" className="input" defaultValue={hoyISO()} /></Field>
                  <Field label="Estado"><select name="estado" className="input" defaultValue="pedida"><option value="prevista">Prevista</option><option value="pedida">Pedida</option><option value="recibida">Recibida</option><option value="pagada">Pagada</option></select></Field>
                </div>
                <Field label="Pagado ($)"><input name="pagado" className="input" inputMode="decimal" defaultValue="0" /></Field>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="requiereAprobacionCliente" /> Requiere aprobación del cliente</label>
              </div>
            </ActionForm>
          </div>
        )}
      </div>
    </>
  );
}
