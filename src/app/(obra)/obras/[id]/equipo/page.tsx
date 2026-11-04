import { requireObra } from "@/lib/access";
import { db, schema } from "@/lib/db";
import { eq, inArray, or } from "drizzle-orm";
import { Badge, Field, PageHeader, Section } from "@/components/ui";
import { ActionForm } from "@/components/forms/form-state";
import { ConfirmAction } from "@/components/client";
import { configurarAccesoObrero, invitarMiembro, quitarMiembro, sumarObreroConDni } from "@/app/actions/obra";
import { ROL_LABEL } from "@/lib/format";

export default async function Equipo({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { obra } = await requireObra(id, ["arquitecto"]);
  const ms = await db.query.miembros.findMany({ where: eq(schema.miembros.obraId, id) });
  const owner = await db.query.users.findFirst({ where: eq(schema.users.id, obra.ownerId) });
  const ids = ms.map((m) => m.userId).filter(Boolean) as string[];
  const usuarios = ms.length ? await db.query.users.findMany({ where: or(inArray(schema.users.email, ms.map((m) => m.email)), ...(ids.length ? [inArray(schema.users.id, ids)] : [])) }) : [];
  const usuarioDe = (m: (typeof ms)[0]) => usuarios.find((u) => u.id === m.userId || u.email === m.email);
  const mailVisible = (e: string) => (e.endsWith(".obrapp.local") ? "" : e);

  return (
    <>
      <PageHeader title="Equipo de la obra" subtitle="Cada persona ve solo lo que le corresponde. Clientes y obreros nunca ven costos internos, honorarios ni ganancia." />
      <div className="grid gap-6 lg:grid-cols-3">
        <Section title={`${ms.length + 1} personas`} className="lg:col-span-2">
          <ul className="divide-y divide-zinc-100">
            <li className="flex items-center justify-between px-5 py-3.5">
              <div><div className="font-medium">{owner?.nombre}</div><div className="text-sm text-zinc-500">{owner?.email}</div></div>
              <Badge tono="verde">Titular</Badge>
            </li>
            {ms.map((m) => {
              const u = usuarioDe(m);
              return (
                <li key={m.id} className="px-5 py-3.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="font-medium">{m.nombre ?? m.email}</div>
                      <div className="text-sm text-zinc-500">{[mailVisible(m.email), u?.dni ? `DNI ${u.dni}` : "", m.oficio].filter(Boolean).join(" · ")}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge>{ROL_LABEL[m.rol]}</Badge>
                      {u ? <Badge tono="verde">Activo</Badge> : <Badge tono="ambar">Invitado</Badge>}
                      <ConfirmAction action={quitarMiembro.bind(null, m.id)} label="Quitar" className="btn-ghost btn-sm text-zinc-500" title={`¿Quitar a ${m.nombre ?? m.email}?`} message="Pierde el acceso a la obra. Sus registros se conservan." />
                    </div>
                  </div>
                  {m.rol === "obrero" && (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-sm font-medium text-brand-700">{u?.dni ? "Cambiar PIN de acceso" : "Darle acceso con DNI y PIN"}</summary>
                      <ActionForm action={configurarAccesoObrero.bind(null, m.id)} submitLabel={u?.dni ? "Generar PIN nuevo" : "Dar acceso"} submitClass="btn-primary btn-sm" className="mt-2">
                        <div className="grid max-w-md grid-cols-2 gap-2">
                          <input name="dni" className="input" placeholder="DNI sin puntos" defaultValue={u?.dni ?? ""} inputMode="numeric" required />
                          <input name="pin" className="input" placeholder="PIN (vacío = automático)" inputMode="numeric" maxLength={6} />
                        </div>
                      </ActionForm>
                    </details>
                  )}
                </li>
              );
            })}
          </ul>
        </Section>

        <div className="space-y-6">
          <div className="card card-pad">
            <div className="h2">Sumar a alguien de la obra</div>
            <p className="muted mb-3 mt-1">Sin email: entra con su DNI y un PIN de 6 números, desde el celular.</p>
            <ActionForm action={sumarObreroConDni.bind(null, id)} resetOnOk submitLabel="Sumar al equipo">
              <div className="space-y-3">
                <Field label="Nombre *"><input name="nombre" className="input" required /></Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="DNI *"><input name="dni" className="input" inputMode="numeric" required placeholder="30123456" /></Field>
                  <Field label="PIN" hint="Vacío = se genera solo"><input name="pin" className="input" inputMode="numeric" maxLength={6} /></Field>
                </div>
                <Field label="Oficio"><input name="oficio" className="input" placeholder="Capataz, plomero, electricista…" /></Field>
              </div>
            </ActionForm>
          </div>

          <div className="card card-pad">
            <div className="h2">Invitar por email</div>
            <p className="muted mb-3 mt-1">Para clientes, arquitectos colaboradores o quien prefiera usar email.</p>
            <ActionForm action={invitarMiembro.bind(null, id)} resetOnOk submitLabel="Invitar">
              <div className="space-y-3">
                <Field label="Email *"><input name="email" type="email" required className="input" /></Field>
                <Field label="Nombre"><input name="nombre" className="input" /></Field>
                <Field label="Perfil">
                  <select name="rol" className="input" defaultValue="cliente">
                    <option value="cliente">Cliente / propietario</option>
                    <option value="obrero">Obrero / encargado</option>
                    <option value="arquitecto">Arquitecto colaborador</option>
                  </select>
                </Field>
              </div>
            </ActionForm>
          </div>
        </div>
      </div>
    </>
  );
}
