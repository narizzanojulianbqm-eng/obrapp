import Link from "next/link";
import { desc, eq, inArray } from "drizzle-orm";
import { requireObra } from "@/lib/access";
import { cargarObra } from "@/lib/obra-service";
import { computoMateriales } from "@/lib/engine/calculos";
import { db, schema } from "@/lib/db";
import { Badge, Empty, Estado, Field, PageHeader, Section } from "@/components/ui";
import { ActionForm } from "@/components/forms/form-state";
import { ActionButton, ConfirmAction } from "@/components/client";
import { agregarProveedorCotizacion, cargarRespuestaCotizacion, crearCotizacion, elegirRespuesta, enviarCotizacionPorEmail } from "@/app/actions/compras";
import { urlApp, emailActivo } from "@/lib/email";
import { CopiarLink } from "./copiar";
import { mensajeCotizacion } from "@/lib/integraciones";
import { ars, num } from "@/lib/format";

export default async function Cotizaciones({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { obra, user } = await requireObra(id, ["arquitecto"]);
  const { items, recursos, insumos } = await cargarObra(id);
  const materiales = computoMateriales(items, recursos, insumos).filter((f) => f.insumo.tipo === "material");
  const provs = await db.query.proveedores.findMany({ where: eq(schema.proveedores.ownerId, obra.ownerId) });
  const cots = await db.query.cotizaciones.findMany({ where: eq(schema.cotizaciones.obraId, id), orderBy: desc(schema.cotizaciones.createdAt) });
  const resps = cots.length ? await db.query.respuestasCotizacion.findMany({ where: inArray(schema.respuestasCotizacion.cotizacionId, cots.map((c) => c.id)) }) : [];
  const pendientesSol = await db.query.solicitudes.findMany({ where: eq(schema.solicitudes.obraId, id) });
  const pedidas = new Map<string, number>();
  pendientesSol.filter((s) => s.estado === "aprobada" && s.insumoId).forEach((s) => pedidas.set(s.insumoId!, (pedidas.get(s.insumoId!) ?? 0) + s.cantidad));

  return (
    <>
      <PageHeader title="Cotizaciones" subtitle="Armá un pedido con materiales del cómputo, envialo a varios corralones por email o WhatsApp, cargá sus respuestas y compará. Ningún pedido ni pago se confirma sin tu autorización." />
      {provs.length === 0 && <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-900">No tenés proveedores cargados. <Link href="/proveedores" className="font-medium underline">Agregalos acá</Link>.</div>}
      <div className="space-y-6">
        {cots.map((c) => {
          const rs = resps.filter((r) => r.cotizacionId === c.id);
          const recibidas = rs.filter((r) => r.estado !== "pendiente");
          const totales = rs.map((r) => ({ r, total: c.lineas.reduce((a, l, i) => a + l.cantidad * (r.precios[i] ?? 0), 0) + r.envio }));
          const mejor = totales.filter((t) => t.r.estado !== "pendiente" && t.total > 0).sort((a, b) => a.total - b.total)[0];
          return (
            <Section key={c.id} title={c.titulo} actions={<div className="flex items-center gap-2">{c.estado !== "cerrada" && rs.some((r) => r.estado === "pendiente") && <ActionButton action={enviarCotizacionPorEmail.bind(null, c.id)}>✉ Enviar a todos por email{emailActivo() ? "" : " (simulado)"}</ActionButton>}<Estado e={c.estado} /></div>}>
              <div className="overflow-x-auto">
                <table className="tbl">
                  <thead>
                    <tr><th>Material</th><th className="num">Cantidad</th>{rs.map((r) => <th key={r.id} className="num">{provs.find((p) => p.id === r.proveedorId)?.nombre}{r.estado === "elegida" && " ✓"}</th>)}</tr>
                  </thead>
                  <tbody>
                    {c.lineas.map((l, i) => {
                      const precios = rs.map((r) => r.precios[i] ?? 0).filter((p) => p > 0);
                      const min = Math.min(...precios);
                      return (
                        <tr key={i}>
                          <td>{l.descripcion}</td>
                          <td className="num">{num(l.cantidad)} {l.unidad}</td>
                          {rs.map((r) => <td key={r.id} className={`num ${r.precios[i] > 0 && r.precios[i] === min && precios.length > 1 ? "font-semibold text-brand-700" : ""}`}>{r.precios[i] > 0 ? ars(r.precios[i], 2) : "—"}</td>)}
                        </tr>
                      );
                    })}
                    <tr><td className="text-zinc-500">Envío</td><td />{rs.map((r) => <td key={r.id} className="num text-zinc-500">{r.estado !== "pendiente" ? ars(r.envio) : "—"}</td>)}</tr>
                    <tr><td className="text-zinc-500">Plazo / disponibilidad</td><td />{rs.map((r) => <td key={r.id} className="num text-xs text-zinc-500">{r.plazoEntregaDias ? `${r.plazoEntregaDias} d` : "—"}{r.disponibilidad ? ` · ${r.disponibilidad}` : ""}</td>)}</tr>
                    <tr><td className="text-zinc-500">Condiciones de pago</td><td />{rs.map((r) => <td key={r.id} className="num text-xs text-zinc-500">{r.condicionesPago ?? "—"}</td>)}</tr>
                    <tr className="font-semibold"><td>Total</td><td />{totales.map((t) => <td key={t.r.id} className={`num ${mejor?.r.id === t.r.id ? "text-brand-700" : ""}`}>{t.r.estado !== "pendiente" ? ars(t.total) : <Badge tono="ambar">esperando</Badge>}</td>)}</tr>
                  </tbody>
                </table>
              </div>
              <div className="grid gap-3 border-t border-zinc-100 p-4 md:grid-cols-2 xl:grid-cols-3">
                {rs.map((r) => {
                  const prov = provs.find((p) => p.id === r.proveedorId)!;
                  const link = `${urlApp()}/cotizar/${r.token}`;
                  const msg = mensajeCotizacion({ obra, proveedor: prov, lineas: c.lineas, firmante: user.nombre, link });
                  return (
                    <div key={r.id} className="rounded-lg border border-zinc-200 p-3 text-sm">
                      <div className="flex items-center justify-between"><span className="font-medium">{prov.nombre}</span><Estado e={r.estado} /></div>
                      <div className="mt-1 text-xs text-zinc-500">
                        {r.enviadaEn ? `Pedido enviado por ${r.canalEnvio} · ` : ""}{r.respondidaPor === "proveedor" ? "Respondió el proveedor en el portal" : r.respondidaPor === "arquitecto" ? "Cargada por vos" : "Sin respuesta"}
                      </div>
                      {r.estado === "elegida" && (
                        <div className="mt-2 rounded-md bg-zinc-50 p-2 text-xs">
                          Pedido: <b>{{ sin_pedido: "esperando aprobación del cliente", enviado: "enviado al proveedor, falta su confirmación", confirmado: `confirmado · entrega ${r.fechaEntrega?.split("-").reverse().join("/")}`, entregado: "entregado en obra" }[r.estadoPedido]}</b>
                        </div>
                      )}
                      {(c.estado !== "cerrada" || r.estado === "elegida") && <div className="mt-2"><CopiarLink link={link} /></div>}
                      {c.estado !== "cerrada" && (
                        <>
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {msg.whatsapp && <a href={msg.whatsapp} target="_blank" className="btn-secondary btn-sm">Enviar por WhatsApp</a>}
                            {msg.mailto && <a href={msg.mailto} className="btn-secondary btn-sm">Enviar por email</a>}
                          </div>
                          <details className="mt-2">
                            <summary className="cursor-pointer text-xs font-medium text-brand-700">Cargar respuesta</summary>
                            <ActionForm action={cargarRespuestaCotizacion.bind(null, r.id)} submitLabel="Guardar" submitClass="btn-primary btn-sm" className="mt-2">
                              <div className="space-y-1.5">
                                {c.lineas.map((l, i) => <label key={i} className="flex items-center justify-between gap-2 text-xs"><span className="truncate">{l.descripcion} ($/{l.unidad})</span><input name={`precio_${i}`} defaultValue={r.precios[i] || ""} className="input-sm w-24 text-right" inputMode="decimal" /></label>)}
                                <div className="grid grid-cols-2 gap-1.5 pt-1">
                                  <input name="envio" placeholder="Envío $" defaultValue={r.envio || ""} className="input-sm" inputMode="decimal" />
                                  <input name="plazoEntregaDias" placeholder="Plazo (días)" defaultValue={r.plazoEntregaDias ?? ""} className="input-sm" inputMode="numeric" />
                                  <input name="condicionesPago" placeholder="Condiciones de pago" defaultValue={r.condicionesPago ?? ""} className="input-sm col-span-2" />
                                  <input name="disponibilidad" placeholder="Disponibilidad" defaultValue={r.disponibilidad ?? ""} className="input-sm col-span-2" />
                                </div>
                              </div>
                            </ActionForm>
                          </details>
                          {r.estado === "recibida" && (
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              <ConfirmAction action={elegirRespuesta.bind(null, r.id, false, true)} label="Elegir y comprar" className="btn-primary btn-sm" title={`¿Confirmar la compra a ${prov.nombre}?`} message="Se registran las compras, se actualizan los precios de los insumos y los costos de la obra." confirmLabel="Confirmar compra" />
                              <ConfirmAction action={elegirRespuesta.bind(null, r.id, true, true)} label="Elegir y pedir aprobación al cliente" className="btn-secondary btn-sm" title="¿Enviar al cliente para aprobar?" confirmLabel="Enviar" />
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  );
                })}
                {c.estado !== "cerrada" && provs.filter((p) => !rs.some((r) => r.proveedorId === p.id)).length > 0 && (
                  <div className="rounded-lg border border-dashed border-zinc-300 p-3 text-sm">
                    <div className="mb-2 text-xs text-zinc-500">Sumar proveedor</div>
                    <div className="flex flex-wrap gap-1.5">{provs.filter((p) => !rs.some((r) => r.proveedorId === p.id)).map((p) => <ActionButton key={p.id} action={agregarProveedorCotizacion.bind(null, c.id, p.id)}>+ {p.nombre}</ActionButton>)}</div>
                  </div>
                )}
              </div>
              {recibidas.length === 0 && c.estado !== "cerrada" && <p className="px-4 pb-4 text-xs text-zinc-500">Enviá el pedido y cargá las respuestas para comparar.</p>}
            </Section>
          );
        })}
        {cots.length === 0 && <Empty title="Todavía no pediste cotizaciones">Seleccioná materiales del cómputo y proveedores en el formulario de abajo.</Empty>}

        <Section title="Nuevo pedido de cotización">
          <ActionForm action={crearCotizacion.bind(null, id)} submitLabel="Crear pedido" className="p-5">
            <Field label="Título"><input name="titulo" className="input" placeholder={`Materiales gruesos – ${obra.nombre}`} /></Field>
            <div className="mt-4 max-h-96 overflow-y-auto rounded-lg border border-zinc-200">
              <table className="tbl">
                <thead><tr><th className="w-8" /><th>Material</th><th className="num">Computado</th><th className="num">Solicitado aprobado</th><th className="num">A cotizar</th></tr></thead>
                <tbody>
                  {materiales.map((m) => (
                    <tr key={m.insumo.id}>
                      <td><input type="checkbox" name="insumoId" value={m.insumo.id} /></td>
                      <td>{m.insumo.nombre}</td>
                      <td className="num text-zinc-500">{num(m.cantidad)} {m.insumo.unidad}</td>
                      <td className="num text-zinc-500">{pedidas.get(m.insumo.id) ? num(pedidas.get(m.insumo.id)) : "—"}</td>
                      <td className="num"><input name={`cant_${m.insumo.id}`} defaultValue={Math.ceil(pedidas.get(m.insumo.id) ?? m.cantidad)} className="input-sm w-24 text-right" inputMode="decimal" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4">
              <div className="label">Proveedores a consultar</div>
              <div className="flex flex-wrap gap-2">{provs.map((p) => <label key={p.id} className="flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-1.5 text-sm"><input type="checkbox" name="proveedorId" value={p.id} />{p.nombre}{p.localidad && obra.localidad && p.localidad.toLowerCase() === obra.localidad.toLowerCase() && <Badge tono="verde">cercano</Badge>}</label>)}</div>
            </div>
          </ActionForm>
        </Section>
      </div>
    </>
  );
}
