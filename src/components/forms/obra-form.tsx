import { Field } from "@/components/ui";
import { SISTEMAS, TIPOS_OBRA } from "@/lib/engine/plantillas";
import type { Obra } from "@/lib/db/schema";
import { ActionForm } from "./form-state";
import type { FormState } from "@/app/actions/auth";

export function ObraForm({ obra, action, nueva }: { obra?: Partial<Obra>; action: (s: FormState, f: FormData) => Promise<FormState>; nueva?: boolean }) {
  const d = obra ?? {};
  return (
    <ActionForm action={action} submitLabel={nueva ? "Crear obra y generar planillas" : "Guardar cambios"}>
      <div className="space-y-6">
        <fieldset className="card card-pad">
          <legend className="h2 mb-4">Proyecto</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nombre del proyecto *" className="sm:col-span-2"><input name="nombre" className="input" required defaultValue={d.nombre ?? ""} placeholder="Vivienda Familia Pérez" /></Field>
            <Field label="Dirección"><input name="direccion" className="input" defaultValue={d.direccion ?? ""} placeholder="Calle 123" /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Localidad"><input name="localidad" className="input" defaultValue={d.localidad ?? ""} /></Field>
              <Field label="Provincia"><input name="provincia" className="input" defaultValue={d.provincia ?? ""} /></Field>
            </div>
            <Field label="Tipo de obra *">
              <select name="tipo" className="input" defaultValue={d.tipo ?? "vivienda_unifamiliar"}>
                {Object.entries(TIPOS_OBRA).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </Field>
            <Field label="Sistema constructivo *">
              <select name="sistema" className="input" defaultValue={d.sistema ?? "tradicional"}>
                {Object.entries(SISTEMAS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </Field>
            <Field label="Características generales" className="sm:col-span-2">
              <textarea name="caracteristicas" rows={3} className="input" defaultValue={d.caracteristicas ?? ""} placeholder="Ej.: 3 dormitorios, 2 baños, cubierta plana, aberturas de aluminio, pisos de porcelanato…" />
            </Field>
          </div>
        </fieldset>

        <fieldset className="card card-pad">
          <legend className="h2 mb-4">Superficies y plazos</legend>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Superficie cubierta (m²) *"><input name="supCubierta" type="number" step="0.01" min="1" className="input" required defaultValue={d.supCubierta ?? ""} /></Field>
            <Field label="Superficie semicubierta (m²)"><input name="supSemicubierta" type="number" step="0.01" min="0" className="input" defaultValue={d.supSemicubierta ?? ""} /></Field>
            <Field label="Cantidad de niveles *"><input name="niveles" type="number" min="1" className="input" required defaultValue={d.niveles ?? 1} /></Field>
            <Field label="Fecha de inicio estimada *"><input name="fechaInicio" type="date" className="input" required defaultValue={d.fechaInicio ?? new Date().toISOString().slice(0, 10)} /></Field>
            <Field label="Duración estimada (días corridos)" hint="Se compara con el cronograma calculado"><input name="duracionEstimadaDias" type="number" min="1" className="input" defaultValue={d.duracionEstimadaDias ?? ""} /></Field>
            <Field label="Presupuesto inicial ($)" hint="Opcional, si el cliente ya tiene un monto"><input name="presupuestoInicial" type="number" step="0.01" min="0" className="input" defaultValue={d.presupuestoInicial ?? ""} /></Field>
          </div>
        </fieldset>

        <fieldset className="card card-pad">
          <legend className="h2 mb-4">Cliente y responsables</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nombre del cliente"><input name="clienteNombre" className="input" defaultValue={d.clienteNombre ?? ""} /></Field>
            <Field label="Email del cliente" hint="Se le da acceso al panel de cliente con este email"><input name="clienteEmail" type="email" className="input" defaultValue={d.clienteEmail ?? ""} /></Field>
            <Field label="Teléfono del cliente"><input name="clienteTelefono" className="input" defaultValue={d.clienteTelefono ?? ""} /></Field>
            <Field label="Arquitecto responsable"><input name="arquitectoResponsable" className="input" defaultValue={d.arquitectoResponsable ?? ""} /></Field>
            {nueva && (
              <Field label="Personal y equipo de trabajo (opcional)" hint="Una persona por línea: email, nombre, oficio. Se suman como obreros." className="sm:col-span-2">
                <textarea name="equipo" rows={3} className="input font-mono text-xs" placeholder={"juan@mail.com, Juan Gómez, Capataz\nlucas@mail.com, Lucas Díaz, Electricista"} />
              </Field>
            )}
            {!nueva && (
              <Field label="Estado de la obra">
                <select name="estado" className="input" defaultValue={d.estado ?? "activa"}>
                  <option value="activa">Activa</option>
                  <option value="pausada">Pausada</option>
                  <option value="finalizada">Finalizada</option>
                </select>
              </Field>
            )}
          </div>
        </fieldset>
      </div>
    </ActionForm>
  );
}
