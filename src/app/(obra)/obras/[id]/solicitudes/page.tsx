import { desc, eq, inArray } from "drizzle-orm";
import { requireObra } from "@/lib/access";
import { cargarObra } from "@/lib/obra-service";
import { db, schema } from "@/lib/db";
import { Badge, Empty, Estado, Field, PageHeader } from "@/components/ui";
import { ActionForm } from "@/components/forms/form-state";
import { ConfirmAction } from "@/components/client";
import { convertirEnCompra, crearSolicitud, responderSolicitud } from "@/app/actions/compras";
import { ArchivoInput } from "@/components/archivo-input";
import { fechaHora, num } from "@/lib/format";
import { fechaLarga, hoyISO, sumarHabiles } from "@/lib/engine/calendario";

export default async function Solicitudes({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { rol, user, obra } = await requireObra(id, ["arquitecto", "obrero"]);
  const { items, insumos } = await cargarObra(id);
  const todas = await db.query.solicitudes.findMany({ where: eq(schema.solicitudes.obraId, id), orderBy: desc(schema.solicitudes.createdAt) });
  const lista = rol === "obrero" ? todas.filter((s) => s.solicitanteId === user.id) : todas;
  const usuarios = lista.length ? await db.query.users.findMany({ where: inArray(schema.users.id, [...new Set(lista.map((s) => s.solicitanteId))]) }) : [];
  const provs = rol === "arquitecto" ? await db.query.proveedores.findMany({ where: eq(schema.proveedores.ownerId, obra.ownerId) }) : [];
  const nombreItem = new Map(items.map((i) => [i.id, i.nombre]));
  const orden = { pendiente: 0, aprobada: 1, en_compra: 2, entregada: 3, rechazada: 4 } as const;
  lista.sort((a, b) => orden[a.estado] - orden[b.estado]);

  const form = (
    <div className="card card-pad h-fit">
      <div className="h2 mb-3">Pedir materiales o herramientas</div>
      <ActionForm action={crearSolicitud.bind(null, id)} resetOnOk submitLabel="Enviar solicitud">
        <datalist id="insumos-lista">{insumos.filter((i) => i.tipo !== "mano_obra").map((i) => <option key={i.id} value={i.nombre} />)}</datalist>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <label className="flex items-center gap-2 rounded-lg border border-zinc-200 px-3 py-2 text-sm has-[:checked]:border-brand-500 has-[:checked]:bg-brand-50"><input type="radio" name="tipo" value="material" defaultChecked /> Material</label>
            <label className="flex items-center gap-2 rounded-lg border border-zinc-200 px-3 py-2 text-sm has-[:checked]:border-brand-500 has-[:checked]:bg-brand-50"><input type="radio" name="tipo" value="herramienta" /> Herramienta</label>
          </div>
          <Field label="¿Qué necesitás? *"><input name="material" list="insumos-lista" className="input" required placeholder="Cemento portland, arena, ladrillos…" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Cantidad *"><input name="cantidad" className="input" inputMode="decimal" required /></Field>
            <Field label="Unidad *"><input name="unidad" className="input" required placeholder="bolsa, m3, u…" /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="¿Para cuándo?"><input name="fechaNecesaria" type="date" className="input" defaultValue={sumarHabiles(hoyISO(), 2)} /></Field>
            <Field label="Prioridad"><select name="prioridad" className="input" defaultValue="media"><option value="baja">Baja</option><option value="media">Media</option><option value="alta">Alta</option><option value="urgente">Urgente</option></select></Field>
          </div>
          <Field label="Tarea relacionada"><select name="itemId" className="input" defaultValue=""><option value="">—</option>{items.filter((i) => !i.esHito && i.avanceReal < 100).map((i) => <option key={i.id} value={i.id}>{i.nombre}</option>)}</select></Field>
          <Field label="Observaciones"><textarea name="observaciones" rows={2} className="input" /></Field>
          <Field label="Foto (opcional)"><ArchivoInput name="fotos" accept="image/*" /></Field>
        </div>
      </ActionForm>
    </div>
  );

  return (
    <>
      <PageHeader title={rol === "obrero" ? "Pedir materiales" : "Solicitudes de materiales"} subtitle={rol === "arquitecto" ? "Pedidos del equipo de obra. Aprobalos, rechazalos o convertilos en compras: quedan vinculados al presupuesto y al cómputo." : "El arquitecto recibe tu pedido al instante."} />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-2">
          {lista.length === 0 && <Empty title="No hay solicitudes" />}
          {lista.map((s) => (
            <div key={s.id} className="card card-pad">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="font-medium">{num(s.cantidad)} {s.unidad} · {s.material} {s.tipo === "herramienta" && <Badge>herramienta</Badge>}</div>
                  <div className="mt-0.5 text-xs text-zinc-500">
                    {usuarios.find((u) => u.id === s.solicitanteId)?.nombre} · {fechaHora(s.createdAt)}{s.fechaNecesaria && ` · para el ${fechaLarga(s.fechaNecesaria)}`}{s.itemId && ` · ${nombreItem.get(s.itemId)}`}
                  </div>
                </div>
                <div className="flex gap-1.5"><Estado e={s.prioridad} /><Estado e={s.estado} /></div>
              </div>
              {s.observaciones && <p className="mt-2 text-sm text-zinc-700">{s.observaciones}</p>}
              {s.respuesta && <p className="mt-1 text-sm text-zinc-500">Respuesta: {s.respuesta}</p>}
              {s.fotos.length > 0 && <div className="mt-2 flex gap-1.5">{s.fotos.map((f) => <a key={f} href={`/api/archivos/${f}`} target="_blank" className="text-xs text-brand-700 underline">Ver foto</a>)}</div>}
              {rol === "arquitecto" && (s.estado === "pendiente" || s.estado === "aprobada") && (
                <div className="mt-3 border-t border-zinc-100 pt-3">
                  <div className="flex flex-wrap gap-2">
                    {s.estado === "pendiente" && <ConfirmAction action={responderSolicitud.bind(null, s.id, "aprobada", undefined, undefined)} label="Aprobar" className="btn-secondary btn-sm" title="¿Aprobar la solicitud?" message="Se notifica a quien la pidió." confirmLabel="Aprobar" />}
                    <ConfirmAction action={responderSolicitud.bind(null, s.id, "rechazada", undefined, undefined)} label="Rechazar" title="¿Rechazar la solicitud?" confirmLabel="Rechazar" />
                    <ConfirmAction action={responderSolicitud.bind(null, s.id, "entregada", "Entregado desde stock de obra", undefined)} label="Hay en obra" className="btn-ghost btn-sm" title="¿Marcar como entregada desde stock?" confirmLabel="Confirmar" />
                  </div>
                  <details className="mt-2">
                    <summary className="cursor-pointer text-sm font-medium text-brand-700">Convertir en compra</summary>
                    <ActionForm action={convertirEnCompra.bind(null, s.id)} submitLabel="Registrar compra" className="mt-3">
                      <div className="grid gap-3 sm:grid-cols-3">
                        <Field label={`Precio unitario ($/${s.unidad})`}><input name="precioUnitario" className="input" inputMode="decimal" required defaultValue={insumos.find((i) => i.id === s.insumoId)?.precio || ""} /></Field>
                        <Field label="Proveedor"><select name="proveedorId" className="input" defaultValue=""><option value="">—</option>{provs.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}</select></Field>
                        <div className="space-y-1.5 pt-5 text-sm">
                          <label className="flex items-center gap-2"><input type="checkbox" name="requiereAprobacionCliente" /> Requiere aprobación del cliente</label>
                          {s.insumoId && <label className="flex items-center gap-2"><input type="checkbox" name="actualizarPrecio" defaultChecked /> Actualizar precio del insumo</label>}
                        </div>
                      </div>
                    </ActionForm>
                  </details>
                </div>
              )}
            </div>
          ))}
        </div>
        {form}
      </div>
    </>
  );
}
