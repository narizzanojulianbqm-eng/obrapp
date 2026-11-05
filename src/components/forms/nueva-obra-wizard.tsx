"use client";
import { useActionState, useRef, useState } from "react";
import type { FormState } from "@/app/actions/auth";

type Opcion = { valor: string; titulo: string; detalle: string };
const TIPOS: Opcion[] = [
  { valor: "vivienda_unifamiliar", titulo: "Casa", detalle: "Vivienda unifamiliar" },
  { valor: "vivienda_multifamiliar", titulo: "Edificio", detalle: "Vivienda multifamiliar" },
  { valor: "ampliacion", titulo: "Ampliación", detalle: "Sumar m² a algo existente" },
  { valor: "refaccion", titulo: "Refacción", detalle: "Remodelar sin estructura nueva" },
  { valor: "local_comercial", titulo: "Local", detalle: "Comercio o showroom" },
  { valor: "oficinas", titulo: "Oficinas", detalle: "Espacio de trabajo" },
];
const SISTEMAS: Opcion[] = [
  { valor: "tradicional", titulo: "Tradicional", detalle: "Hormigón armado y ladrillo" },
  { valor: "steel_frame", titulo: "Steel frame", detalle: "Construcción en seco" },
];

function Tarjetas({ name, opciones, valor, onChange }: { name: string; opciones: Opcion[]; valor: string; onChange: (v: string) => void }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {opciones.map((o) => (
        <label key={o.valor} className={`cursor-pointer rounded-xl border-2 p-4 transition ${valor === o.valor ? "border-brand-700 bg-brand-50" : "border-zinc-200 bg-white hover:border-zinc-300"}`}>
          <input type="radio" name={name} value={o.valor} checked={valor === o.valor} onChange={() => onChange(o.valor)} className="sr-only" />
          <div className="text-base font-semibold text-zinc-900">{o.titulo}</div>
          <div className="mt-0.5 text-sm text-zinc-500">{o.detalle}</div>
        </label>
      ))}
    </div>
  );
}

/** Alta de obra en 3 pasos cortos. Lo demás (dirección, presupuesto, equipo…) se completa después en Ajustes de obra. */
export function NuevaObraWizard({ action }: { action: (s: FormState, f: FormData) => Promise<FormState> }) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const [paso, setPaso] = useState(1);
  const [tipo, setTipo] = useState("vivienda_unifamiliar");
  const [sistema, setSistema] = useState("tradicional");
  const pasos = useRef<(HTMLDivElement | null)[]>([]);

  const siguiente = () => {
    const campos = pasos.current[paso - 1]?.querySelectorAll<HTMLInputElement>("input[required]") ?? [];
    for (const c of Array.from(campos)) if (!c.reportValidity()) return;
    setPaso(paso + 1);
  };

  const etiquetas = ["La obra", "Tamaño y fecha", "Cliente"];
  const lbl = "mb-1.5 block text-[15px] font-medium text-zinc-800";
  const inp = "block w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-base focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100";

  return (
    <form action={formAction} className="mx-auto max-w-2xl">
      <ol className="mb-8 flex items-center gap-2">
        {etiquetas.map((e, i) => (
          <li key={e} className="flex flex-1 items-center gap-2">
            <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${paso > i + 1 ? "bg-brand-700 text-white" : paso === i + 1 ? "bg-zinc-900 text-white" : "bg-zinc-200 text-zinc-500"}`}>{paso > i + 1 ? "✓" : i + 1}</span>
            <span className={`hidden text-sm sm:block ${paso === i + 1 ? "font-medium text-zinc-900" : "text-zinc-500"}`}>{e}</span>
            {i < etiquetas.length - 1 && <span className="h-px flex-1 bg-zinc-200" />}
          </li>
        ))}
      </ol>

      <div ref={(el) => { pasos.current[0] = el; }} className={paso === 1 ? "space-y-6" : "hidden"}>
        <label className="block">
          <span className={lbl}>¿Cómo se llama la obra?</span>
          <input name="nombre" required minLength={2} className={inp} placeholder="Ej.: Casa Familia Pérez" autoFocus />
        </label>
        <div>
          <span className={lbl}>¿Qué tipo de obra es?</span>
          <Tarjetas name="tipo" opciones={TIPOS} valor={tipo} onChange={setTipo} />
        </div>
        <div>
          <span className={lbl}>¿Con qué sistema se construye?</span>
          <Tarjetas name="sistema" opciones={SISTEMAS} valor={sistema} onChange={setSistema} />
        </div>
      </div>

      <div ref={(el) => { pasos.current[1] = el; }} className={paso === 2 ? "space-y-6" : "hidden"}>
        <div className="grid gap-5 sm:grid-cols-2">
          <label className="block">
            <span className={lbl}>Superficie cubierta (m²)</span>
            <input name="supCubierta" type="number" min="1" step="0.01" required className={inp} placeholder="Ej.: 140" />
          </label>
          <label className="block">
            <span className={lbl}>Cantidad de plantas</span>
            <input name="niveles" type="number" min="1" required defaultValue={1} className={inp} />
          </label>
          <label className="block">
            <span className={lbl}>¿Cuándo empieza?</span>
            <input name="fechaInicio" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} className={inp} />
          </label>
          <label className="block">
            <span className={lbl}>Localidad</span>
            <input name="localidad" className={inp} placeholder="Ej.: Pilar" />
          </label>
        </div>
        <details className="rounded-xl border border-zinc-200 bg-white px-4 py-3">
          <summary className="cursor-pointer text-sm text-zinc-600">Opcional: superficie semicubierta</summary>
          <input name="supSemicubierta" type="number" min="0" step="0.01" className={`${inp} mt-3`} placeholder="m² de galerías, aleros, cocheras…" />
        </details>
      </div>

      <div ref={(el) => { pasos.current[2] = el; }} className={paso === 3 ? "space-y-6" : "hidden"}>
        <p className="text-[15px] text-zinc-600">Opcional. Si cargás el email del cliente, va a poder seguir la obra desde su celular.</p>
        <label className="block">
          <span className={lbl}>Nombre del cliente</span>
          <input name="clienteNombre" className={inp} />
        </label>
        <label className="block">
          <span className={lbl}>Email del cliente</span>
          <input name="clienteEmail" type="email" className={inp} />
        </label>
        <div className="rounded-xl bg-brand-50 p-4 text-[15px] text-brand-900">
          Al crear la obra se arman solos los rubros, las cantidades, el presupuesto y el cronograma. Después podés ajustar todo.
        </div>
        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-zinc-200 p-4 text-[15px] hover:bg-zinc-50">
          <input type="checkbox" name="desdeArchivo" className="mt-1 h-4 w-4 accent-brand-700" />
          <span><b>Ya tengo el presupuesto o el cómputo armado</b><span className="block text-sm text-zinc-500">Al crear la obra te llevamos a cargarlo desde Excel, PDF, Word o una foto.</span></span>
        </label>
      </div>

      {state?.error && <p className="mt-6 rounded-xl bg-red-50 px-4 py-3 text-[15px] text-red-700">{state.error}</p>}

      <div className="mt-8 flex items-center justify-between">
        {paso > 1 ? <button type="button" onClick={() => setPaso(paso - 1)} className="btn-ghost px-4 py-3 text-base">← Atrás</button> : <span />}
        {paso < 3 ? (
          <button key="siguiente" type="button" onClick={siguiente} className="btn-primary px-6 py-3 text-base">Siguiente →</button>
        ) : (
          <button key="crear" type="submit" className="btn-primary px-6 py-3 text-base" disabled={pending}>{pending ? "Armando la obra…" : "Crear obra"}</button>
        )}
      </div>
    </form>
  );
}
