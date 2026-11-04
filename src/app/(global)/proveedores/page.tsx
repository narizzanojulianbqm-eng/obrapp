import { asc, eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { Badge, Empty, Field, PageHeader } from "@/components/ui";
import { ActionForm } from "@/components/forms/form-state";
import { ConfirmAction } from "@/components/client";
import { eliminarProveedor, guardarProveedor } from "@/app/actions/compras";

const CANAL = { email: "Email", whatsapp: "WhatsApp", telefono: "Teléfono", api: "API", catalogo: "Catálogo digital" } as const;

function ProvFields({ p }: { p?: typeof schema.proveedores.$inferSelect }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Nombre *"><input name="nombre" className="input" required defaultValue={p?.nombre} /></Field>
      <Field label="Rubro"><input name="rubro" className="input" defaultValue={p?.rubro ?? ""} placeholder="Corralón, sanitarios, electricidad…" /></Field>
      <Field label="Localidad"><input name="localidad" className="input" defaultValue={p?.localidad ?? ""} /></Field>
      <Field label="Dirección"><input name="direccion" className="input" defaultValue={p?.direccion ?? ""} /></Field>
      <Field label="Email"><input name="email" type="email" className="input" defaultValue={p?.email ?? ""} /></Field>
      <Field label="WhatsApp"><input name="whatsapp" className="input" defaultValue={p?.whatsapp ?? ""} placeholder="11 5555 5555" /></Field>
      <Field label="Teléfono"><input name="telefono" className="input" defaultValue={p?.telefono ?? ""} /></Field>
      <Field label="Canal preferido para cotizar">
        <select name="canal" className="input" defaultValue={p?.canal ?? "email"}>
          {Object.entries(CANAL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </Field>
      <Field label="Notas" className="sm:col-span-2"><input name="notas" className="input" defaultValue={p?.notas ?? ""} /></Field>
    </div>
  );
}

export default async function Proveedores() {
  const user = await requireUser();
  const provs = await db.query.proveedores.findMany({ where: eq(schema.proveedores.ownerId, user.id), orderBy: asc(schema.proveedores.nombre) });
  return (
    <>
      <PageHeader title="Proveedores" subtitle="Tu base de corralones y proveedores. Se usa para pedir y comparar cotizaciones en cada obra." />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-2">
          {provs.length === 0 && <Empty title="Sin proveedores">Cargá los corralones y comercios con los que trabajás.</Empty>}
          {provs.map((p) => (
            <details key={p.id} className="card group">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4">
                <div>
                  <div className="font-medium">{p.nombre}</div>
                  <div className="text-xs text-zinc-500">{[p.rubro, p.localidad, p.email, p.whatsapp].filter(Boolean).join(" · ")}</div>
                </div>
                <Badge>{CANAL[p.canal]}</Badge>
              </summary>
              <div className="border-t border-zinc-100 px-5 py-4">
                <ActionForm action={guardarProveedor.bind(null, p.id)}>
                  <ProvFields p={p} />
                </ActionForm>
                <div className="mt-3 flex justify-end">
                  <ConfirmAction action={eliminarProveedor.bind(null, p.id)} label="Eliminar" title={`¿Eliminar ${p.nombre}?`} />
                </div>
              </div>
            </details>
          ))}
        </div>
        <div className="card card-pad h-fit">
          <div className="h2 mb-3">Nuevo proveedor</div>
          <ActionForm action={guardarProveedor.bind(null, null)} resetOnOk submitLabel="Agregar">
            <ProvFields />
          </ActionForm>
        </div>
      </div>
    </>
  );
}
