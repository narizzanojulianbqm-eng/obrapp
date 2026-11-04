import { and, desc, eq, gte, inArray } from "drizzle-orm";
import { requireObra } from "@/lib/access";
import { db, schema } from "@/lib/db";
import { Badge, Field, PageHeader, Section, Stat } from "@/components/ui";
import { ActionForm } from "@/components/forms/form-state";
import { ArchivoInput } from "@/components/archivo-input";
import { guardarParteDiario } from "@/app/actions/obra";
import { hoyAR, num } from "@/lib/format";

const CLIMA = { bueno: "☀️ Bueno", nublado: "☁️ Nublado", lluvia: "🌧️ Lluvia", viento: "💨 Viento", calor: "🥵 Calor", frio: "🥶 Frío" } as const;
const fechaTxt = (f: string) => new Date(`${f}T12:00:00`).toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" });
const restarDias = (f: string, d: number) => { const x = new Date(`${f}T12:00:00`); x.setDate(x.getDate() - d); return x.toISOString().slice(0, 10); };

export default async function Partes({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { rol, user } = await requireObra(id);
  const hoy = hoyAR();
  const partes = await db.query.partesDiarios.findMany({ where: eq(schema.partesDiarios.obraId, id), orderBy: [desc(schema.partesDiarios.fecha), desc(schema.partesDiarios.createdAt)], limit: 60 });
  const autores = partes.length ? await db.query.users.findMany({ where: inArray(schema.users.id, [...new Set(partes.map((p) => p.autorId))]), columns: { id: true, nombre: true } }) : [];
  const desde = restarDias(hoy, 6);
  const semana = await db.query.partesDiarios.findMany({ where: and(eq(schema.partesDiarios.obraId, id), gte(schema.partesDiarios.fecha, desde)) });
  const diasConParte = new Set(semana.map((p) => p.fecha)).size;
  const horasHombre = semana.reduce((s, p) => s + p.personas * p.horas, 0);
  const lluvia = semana.filter((p) => p.clima === "lluvia").length;
  const problemas = semana.filter((p) => p.problema).length;
  const puedeCargar = rol !== "cliente";
  const yaCargoHoy = partes.some((p) => p.fecha === hoy && p.autorId === user.id);

  const form = (
    <div className="card card-pad">
      <div className="h2">Parte del día</div>
      <p className="muted mb-4 mt-1">{yaCargoHoy ? "Ya cargaste el de hoy. Podés sumar otro si hace falta." : "Un minuto al terminar la jornada. Lo ve el arquitecto al instante."}</p>
      <ActionForm action={guardarParteDiario.bind(null, id)} resetOnOk submitLabel="Guardar parte" submitClass="btn-primary w-full py-3 text-base">
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <Field label="Fecha"><input name="fecha" type="date" className="input" defaultValue={hoy} max={hoy} /></Field>
            <Field label="Personas"><input name="personas" type="number" min={0} className="input" inputMode="numeric" placeholder="4" /></Field>
            <Field label="Horas c/u"><input name="horas" className="input" inputMode="decimal" defaultValue="8" /></Field>
          </div>
          <fieldset>
            <span className="label">Clima</span>
            <div className="flex flex-wrap gap-2">
              {Object.entries(CLIMA).map(([k, v]) => (
                <label key={k} className="cursor-pointer">
                  <input type="radio" name="clima" value={k} defaultChecked={k === "bueno"} className="peer sr-only" />
                  <span className="inline-block rounded-full border border-zinc-200 px-3 py-1.5 text-sm peer-checked:border-brand-700 peer-checked:bg-brand-50 peer-checked:text-brand-700">{v}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <Field label="¿Qué se hizo hoy?"><textarea name="trabajos" rows={3} className="input" placeholder="Ej: terminamos la carpeta del baño, arrancamos revoque grueso en el living" /></Field>
          <Field label="¿Hubo algún problema?" hint="Si escribís algo acá, el arquitecto recibe un aviso."><textarea name="problema" rows={2} className="input" placeholder="Opcional: faltó material, llovió, se rompió algo…" /></Field>
          <Field label="Fotos"><ArchivoInput name="fotos" accept="image/*" multiple /></Field>
        </div>
      </ActionForm>
    </div>
  );

  return (
    <>
      <PageHeader title="Partes diarios" subtitle="Quién trabajó, cuántas horas, el clima y qué se hizo cada día." />
      {rol === "arquitecto" && (
        <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Días con parte (7 días)" value={`${diasConParte} de 7`} />
          <Stat label="Horas hombre (7 días)" value={num(horasHombre, 0)} />
          <Stat label="Días de lluvia" value={String(lluvia)} />
          <Stat label="Problemas informados" value={String(problemas)} />
        </div>
      )}
      <div className={`grid gap-6 ${puedeCargar ? "lg:grid-cols-5" : ""}`}>
        {puedeCargar && <div className="lg:col-span-2">{form}</div>}
        <Section title="Últimos partes" className={puedeCargar ? "lg:col-span-3" : ""}>
          <ul className="divide-y divide-zinc-100">
            {partes.length === 0 && <li className="muted p-5">Todavía no hay partes. {rol === "arquitecto" ? "Los carga el encargado desde el celular (también entra con DNI y PIN)." : ""}</li>}
            {partes.map((p) => (
              <li key={p.id} className="px-5 py-3.5 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium first-letter:uppercase">{fechaTxt(p.fecha)}</span>
                  <div className="flex items-center gap-1.5">
                    {p.problema && <Badge tono="rojo">Problema</Badge>}
                    <Badge>{CLIMA[p.clima]}</Badge>
                    <Badge tono="verde">{p.personas} pers. · {num(p.horas, 1)} h</Badge>
                  </div>
                </div>
                {p.trabajos && <p className="mt-1 whitespace-pre-line text-zinc-700">{p.trabajos}</p>}
                {p.problema && <p className="mt-1 rounded-md bg-red-50 px-2 py-1 text-red-700">⚠ {p.problema}</p>}
                {p.fotos.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {p.fotos.map((f) => (
                      <a key={f} href={`/api/archivos/${f}`} target="_blank" className="h-16 w-16 overflow-hidden rounded bg-zinc-100">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={`/api/archivos/${f}`} alt="" className="h-full w-full object-cover" />
                      </a>
                    ))}
                  </div>
                )}
                <div className="mt-1 text-xs text-zinc-400">{autores.find((u) => u.id === p.autorId)?.nombre}{p.origen === "whatsapp" ? " · por WhatsApp" : ""}</div>
              </li>
            ))}
          </ul>
        </Section>
      </div>
    </>
  );
}
