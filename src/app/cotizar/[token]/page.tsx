import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { ActionForm } from "@/components/forms/form-state";
import { confirmarEntregaProveedor, confirmarPedidoProveedor, responderComoProveedor } from "@/app/actions/compras";
import { ars, num } from "@/lib/format";
import { hoyISO, sumarHabiles, fechaLarga } from "@/lib/engine/calendario";

export const metadata = { title: "Cotización — Obrapp", robots: { index: false } };

/** Portal público para proveedores: se accede solo con el link (token aleatorio de 128 bits). */
export default async function PortalProveedor({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[a-f0-9]{32}$/.test(token)) notFound();
  const r = await db.query.respuestasCotizacion.findFirst({ where: eq(schema.respuestasCotizacion.token, token) });
  if (!r) notFound();
  const c = (await db.query.cotizaciones.findFirst({ where: eq(schema.cotizaciones.id, r.cotizacionId) }))!;
  const obra = (await db.query.obras.findFirst({ where: eq(schema.obras.id, c.obraId) }))!;
  const prov = (await db.query.proveedores.findFirst({ where: eq(schema.proveedores.id, r.proveedorId) }))!;
  const arq = await db.query.users.findFirst({ where: eq(schema.users.id, obra.ownerId) });
  const total = c.lineas.reduce((a, l, i) => a + l.cantidad * (r.precios[i] ?? 0), 0) + r.envio;
  const elegida = r.estado === "elegida";
  const cerrada = c.estado === "cerrada" && !elegida;

  return (
    <div className="min-h-screen bg-zinc-50">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center gap-2 px-5 py-4">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-brand-700 text-xs font-bold text-white">O</div>
          <span className="font-semibold">Obrapp</span>
          <span className="ml-auto text-sm text-zinc-500">Portal de proveedores</span>
        </div>
      </header>
      <main className="mx-auto max-w-3xl space-y-5 px-5 py-8">
        <div>
          <div className="text-sm text-zinc-500">Para: <b className="text-zinc-800">{prov.nombre}</b></div>
          <h1 className="h1 mt-1">{elegida ? "Pedido de materiales" : "Pedido de cotización"}</h1>
          <p className="muted mt-1">
            Obra <b>{obra.nombre}</b> · {[obra.direccion, obra.localidad, obra.provincia].filter(Boolean).join(", ")} · Solicita: {arq?.nombre ?? obra.arquitectoResponsable}
          </p>
        </div>

        {cerrada ? (
          <div className="card card-pad">Esta cotización ya fue cerrada. ¡Gracias por participar!</div>
        ) : elegida ? (
          <>
            <div className="card card-pad border-brand-500 bg-brand-50 text-sm text-brand-900">
              {r.estadoPedido === "sin_pedido" && "Su cotización fue elegida. El pedido se libera apenas el comitente lo apruebe; le avisaremos."}
              {r.estadoPedido === "enviado" && "¡Su cotización fue elegida! Por favor confirme el pedido y la fecha de entrega."}
              {r.estadoPedido === "confirmado" && `Pedido confirmado con entrega prevista el ${fechaLarga(r.fechaEntrega)}. Cuando entregue en obra, márquelo abajo.`}
              {r.estadoPedido === "entregado" && "Entrega registrada. ¡Gracias!"}
            </div>
            <Tabla c={c} r={r} total={total} />
            {r.estadoPedido === "enviado" && (
              <div className="card card-pad">
                <ActionForm action={confirmarPedidoProveedor.bind(null, token)} submitLabel="Confirmar pedido">
                  <label className="block max-w-xs"><span className="label">Fecha de entrega en obra</span><input type="date" name="fechaEntrega" className="input" required min={hoyISO()} defaultValue={sumarHabiles(hoyISO(), r.plazoEntregaDias ?? 2)} /></label>
                </ActionForm>
              </div>
            )}
            {r.estadoPedido === "confirmado" && (
              <div className="card card-pad">
                <ActionForm action={confirmarEntregaProveedor.bind(null, token)} submitLabel="Confirmar entrega en obra">
                  <label className="block max-w-xs"><span className="label">N° de remito (opcional)</span><input name="remito" className="input" /></label>
                </ActionForm>
              </div>
            )}
          </>
        ) : (
          <div className="card card-pad">
            <ActionForm action={responderComoProveedor.bind(null, token)} submitLabel={r.estado === "recibida" ? "Actualizar cotización" : "Enviar cotización"}>
              <div className="overflow-x-auto">
                <table className="tbl">
                  <thead><tr><th>Material</th><th className="num">Cantidad</th><th className="num">Precio unitario ($)</th></tr></thead>
                  <tbody>
                    {c.lineas.map((l, i) => (
                      <tr key={i}>
                        <td>{l.descripcion}</td>
                        <td className="num whitespace-nowrap">{num(l.cantidad)} {l.unidad}</td>
                        <td className="num"><input name={`precio_${i}`} inputMode="decimal" className="input-sm w-36 text-right" defaultValue={r.precios[i] || ""} placeholder={`$ / ${l.unidad}`} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <label className="block"><span className="label">Costo de envío a obra ($)</span><input name="envio" inputMode="decimal" className="input" defaultValue={r.envio || ""} /></label>
                <label className="block"><span className="label">Plazo de entrega (días hábiles)</span><input name="plazoEntregaDias" type="number" min="0" className="input" defaultValue={r.plazoEntregaDias ?? ""} /></label>
                <label className="block"><span className="label">Condiciones de pago</span><input name="condicionesPago" className="input" placeholder="Contado, transferencia, 30 días…" defaultValue={r.condicionesPago ?? ""} /></label>
                <label className="block"><span className="label">Disponibilidad</span><input name="disponibilidad" className="input" placeholder="Stock inmediato, a pedido…" defaultValue={r.disponibilidad ?? ""} /></label>
                <label className="block sm:col-span-2"><span className="label">Observaciones</span><textarea name="notas" rows={2} className="input" defaultValue={r.notasProveedor ?? ""} /></label>
              </div>
              <p className="mt-3 text-xs text-zinc-500">Deje vacío lo que no cotiza. Puede volver a este link para modificar los valores mientras la cotización esté abierta.</p>
            </ActionForm>
          </div>
        )}
        <p className="text-center text-xs text-zinc-400">Este link es personal para {prov.nombre}. No lo comparta.</p>
      </main>
    </div>
  );
}

function Tabla({ c, r, total }: { c: typeof schema.cotizaciones.$inferSelect; r: typeof schema.respuestasCotizacion.$inferSelect; total: number }) {
  return (
    <div className="card overflow-x-auto">
      <table className="tbl">
        <thead><tr><th>Material</th><th className="num">Cantidad</th><th className="num">P. unit.</th><th className="num">Subtotal</th></tr></thead>
        <tbody>
          {c.lineas.map((l, i) => (
            <tr key={i}><td>{l.descripcion}</td><td className="num">{num(l.cantidad)} {l.unidad}</td><td className="num">{ars(r.precios[i], 2)}</td><td className="num">{ars(l.cantidad * (r.precios[i] ?? 0))}</td></tr>
          ))}
          {r.envio > 0 && <tr><td colSpan={3}>Envío</td><td className="num">{ars(r.envio)}</td></tr>}
          <tr className="font-semibold"><td colSpan={3}>Total</td><td className="num">{ars(total)}</td></tr>
        </tbody>
      </table>
    </div>
  );
}
