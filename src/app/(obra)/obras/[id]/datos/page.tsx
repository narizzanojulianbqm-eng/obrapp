import { requireObra } from "@/lib/access";
import { Field, PageHeader } from "@/components/ui";
import { ObraForm } from "@/components/forms/obra-form";
import { ActionForm } from "@/components/forms/form-state";
import { ConfirmAction } from "@/components/client";
import { actualizarObra, actualizarParametros, eliminarObra, guardarPortalCliente, regenerarDesdePlantilla } from "@/app/actions/obra";
import { clienteVe, SECCIONES_PORTAL } from "@/lib/portal";
import { magnitudes, PARAMETROS_INFO, parametrosPorDefecto } from "@/lib/engine/plantillas";
import { num } from "@/lib/format";

export default async function Datos({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { obra, esDueno } = await requireObra(id, ["arquitecto"]);
  const defs = parametrosPorDefecto(obra);
  const actuales = { ...defs, ...obra.parametros };
  const m = magnitudes(obra, actuales);
  return (
    <div className="max-w-4xl space-y-8">
      <PageHeader title="Datos de obra" subtitle="Si cambiás superficies o parámetros, se recalculan automáticamente el cómputo, el presupuesto y el cronograma." />
      <ObraForm obra={obra} action={actualizarObra.bind(null, id)} />

      <section id="parametros" className="card card-pad">
        <div className="h2">Parámetros de cómputo</div>
        <p className="muted mb-4 mt-1">Se estiman a partir de la superficie y los niveles. Reemplazalos por las medidas reales del proyecto para obtener cantidades precisas. Dejá un campo vacío para volver al valor estimado.</p>
        <ActionForm action={actualizarParametros.bind(null, id)} submitLabel="Guardar parámetros y recalcular">
          <div className="grid gap-4 sm:grid-cols-3">
            {Object.entries(PARAMETROS_INFO).map(([k, info]) => (
              <Field key={k} label={`${info.label} (${info.unidad})`} hint={obra.parametros[k] != null ? `Estimado: ${num(defs[k])}` : info.ayuda || "Valor estimado"}>
                <input name={k} className={`input ${obra.parametros[k] != null ? "border-brand-500" : ""}`} inputMode="decimal" defaultValue={obra.parametros[k] ?? ""} placeholder={String(defs[k])} />
              </Field>
            ))}
            <Field label="Cuadrilla tipo (horas-hombre por día)" hint="16 = oficial + ayudante, 8 h. Define las duraciones.">
              <input name="cuadrillaHHdia" className="input" inputMode="decimal" defaultValue={obra.cuadrillaHHdia} />
            </Field>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 rounded-lg bg-zinc-50 p-3 text-xs text-zinc-600 sm:grid-cols-4">
            <div>Mampostería exterior<br /><b className="text-sm text-zinc-900">{num(m.muroExt, 1)} m²</b></div>
            <div>Muros interiores<br /><b className="text-sm text-zinc-900">{num(m.muroInt, 1)} m²</b></div>
            <div>Cimientos<br /><b className="text-sm text-zinc-900">{num(m.cimientos, 1)} ml</b></div>
            <div>Planta tipo<br /><b className="text-sm text-zinc-900">{num(m.planta, 1)} m²</b></div>
          </div>
        </ActionForm>
      </section>

      <section id="portal" className="card card-pad">
        <div className="h2">Qué ve el cliente</div>
        <p className="muted mb-4 mt-1">Elegí qué secciones aparecen en el portal de tu cliente. Nunca ve costos internos, honorarios ni ganancia, aunque marques todo.</p>
        <ActionForm action={guardarPortalCliente.bind(null, id)} submitLabel="Guardar">
          <div className="grid gap-2 sm:grid-cols-2">
            {SECCIONES_PORTAL.map((s) => (
              <label key={s.clave} className="flex cursor-pointer items-center gap-3 rounded-lg border border-zinc-200 px-3 py-2.5 hover:bg-zinc-50">
                <input type="checkbox" name={s.clave} defaultChecked={clienteVe(obra, s.clave)} className="h-4 w-4 accent-brand-700" />
                <span>{s.label}</span>
              </label>
            ))}
          </div>
        </ActionForm>
      </section>

      <section className="card card-pad">
        <div className="h2">Plantilla y acciones</div>
        <p className="muted mt-1">Regenerar reemplaza rubros, ítems y análisis de precios por los de la plantilla del tipo y sistema actuales. Se conservan los precios cargados en los insumos.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <ConfirmAction action={regenerarDesdePlantilla.bind(null, id)} label="Regenerar rubros desde plantilla" className="btn-secondary" title="¿Regenerar rubros?" message="Se perderán los ítems, cantidades manuales, avances y dependencias editadas. Los precios de insumos se conservan." confirmLabel="Regenerar" />
          {esDueno && <ConfirmAction action={eliminarObra.bind(null, id)} label="Eliminar obra" className="btn-danger" title="¿Eliminar la obra definitivamente?" message="Se borran todos sus datos, mensajes y documentos. Esta acción no se puede deshacer." confirmLabel="Eliminar" />}
        </div>
      </section>
    </div>
  );
}
