import { requireObra } from "@/lib/access";
import { db, schema } from "@/lib/db";
import { eq, inArray } from "drizzle-orm";
import { Badge, Field, PageHeader, Section } from "@/components/ui";
import { ActionForm } from "@/components/forms/form-state";
import { ConfirmAction } from "@/components/client";
import { invitarMiembro, quitarMiembro } from "@/app/actions/obra";
import { ROL_LABEL } from "@/lib/format";

export default async function Equipo({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { obra } = await requireObra(id, ["arquitecto"]);
  const ms = await db.query.miembros.findMany({ where: eq(schema.miembros.obraId, id) });
  const owner = await db.query.users.findFirst({ where: eq(schema.users.id, obra.ownerId) });
  const registrados = ms.length ? await db.query.users.findMany({ where: inArray(schema.users.email, ms.map((m) => m.email)) }) : [];
  return (
    <>
      <PageHeader title="Equipo de la obra" subtitle="Cada persona ve solo lo que corresponde a su perfil. Los clientes y obreros nunca ven costos internos, honorarios ni beneficios." />
      <div className="grid gap-6 lg:grid-cols-3">
        <Section title={`${ms.length + 1} personas`} className="lg:col-span-2">
          <table className="tbl">
            <thead><tr><th>Persona</th><th>Perfil</th><th>Estado</th><th></th></tr></thead>
            <tbody>
              <tr><td><div className="font-medium">{owner?.nombre}</div><div className="text-xs text-zinc-500">{owner?.email}</div></td><td><Badge tono="verde">Titular</Badge></td><td>Activo</td><td /></tr>
              {ms.map((m) => (
                <tr key={m.id}>
                  <td><div className="font-medium">{m.nombre ?? m.email}</div><div className="text-xs text-zinc-500">{m.email}{m.oficio ? ` · ${m.oficio}` : ""}</div></td>
                  <td><Badge>{ROL_LABEL[m.rol]}</Badge></td>
                  <td>{registrados.some((u) => u.email === m.email) ? <Badge tono="verde">Activo</Badge> : <Badge tono="ambar">Invitado</Badge>}</td>
                  <td className="text-right"><ConfirmAction action={quitarMiembro.bind(null, m.id)} label="Quitar" title={`¿Quitar a ${m.nombre ?? m.email}?`} message="Pierde el acceso a la obra. Sus mensajes y registros se conservan." /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
        <div className="card card-pad h-fit">
          <div className="h2 mb-3">Sumar persona</div>
          <ActionForm action={invitarMiembro.bind(null, id)} resetOnOk submitLabel="Agregar a la obra">
            <div className="space-y-3">
              <Field label="Email *"><input name="email" type="email" required className="input" /></Field>
              <Field label="Nombre"><input name="nombre" className="input" /></Field>
              <Field label="Perfil">
                <select name="rol" className="input" defaultValue="obrero">
                  <option value="obrero">Obrero / encargado</option>
                  <option value="cliente">Cliente / propietario</option>
                  <option value="arquitecto">Arquitecto colaborador</option>
                </select>
              </Field>
              <Field label="Oficio / función"><input name="oficio" className="input" placeholder="Capataz, electricista, plomero…" /></Field>
            </div>
          </ActionForm>
          <p className="mt-3 text-xs text-zinc-500">Si la persona todavía no tiene cuenta, va a ver la obra apenas se registre con ese email.</p>
        </div>
      </div>
    </>
  );
}
