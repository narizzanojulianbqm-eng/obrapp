"use client";
import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { analizarArchivo, importarPlanilla, type FilaVista } from "@/app/actions/obra";
import { comprimirImagen } from "@/components/archivo-input";

type Fila = FilaVista & { incluir: boolean; vincular: boolean; archivo: string };

const ACEPTA = ".xlsx,.xlsm,.xls,.csv,.pdf,.docx,.txt,image/*";
const FUENTE: Record<string, string> = { planilla: "Excel", pdf: "PDF", word: "Word", texto: "texto", foto: "foto (leída en tu navegador)", ia: "IA" };
const esImagen = (f: File) => f.type.startsWith("image/") || /\.(png|jpe?g|webp|gif)$/i.test(f.name);

/** Lee el texto de una foto en el navegador del usuario (gratis, sin enviar la imagen). */
async function ocrEnNavegador(f: File, onProgreso: (p: number) => void): Promise<string> {
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("spa", 1, { logger: (m: { status: string; progress: number }) => { if (m.status === "recognizing text") onProgreso(Math.round(m.progress * 100)); } });
  try {
    const { data } = await worker.recognize(f);
    return data.text;
  } finally {
    await worker.terminate();
  }
}

export function CargarDesdeArchivo({ obraId, iaDisponible, abiertoInicial = false, demo = false, modoInicial = "agregar" }: { obraId: string; iaDisponible: boolean; abiertoInicial?: boolean; demo?: boolean; modoInicial?: "agregar" | "reemplazar" }) {
  const [abierto, setAbierto] = useState(abiertoInicial);
  const [modoEntrada, setModoEntrada] = useState<"archivo" | "texto">("archivo");
  const [filas, setFilas] = useState<Fila[]>([]);
  const [avisos, setAvisos] = useState<string[]>([]);
  const [estado, setEstado] = useState<string | null>(null);
  const [resultado, setResultado] = useState<string | null>(null);
  const [modo, setModo] = useState<"agregar" | "reemplazar">(demo ? "agregar" : modoInicial);
  const [arrastrando, setArrastrando] = useState(false);
  const [texto, setTexto] = useState("");
  const [pending, start] = useTransition();
  const input = useRef<HTMLInputElement>(null);
  const router = useRouter();

  async function procesar(archivos: File[]) {
    setResultado(null);
    const nuevos: Fila[] = [];
    const adv: string[] = [];
    for (const f of archivos) {
      const fd = new FormData();
      try {
        if (esImagen(f) && !iaDisponible) {
          setEstado(`Leyendo la foto "${f.name}"… 0%`);
          const t = await ocrEnNavegador(f, (p) => setEstado(`Leyendo la foto "${f.name}"… ${p}%`));
          fd.set("texto", t);
          fd.set("origen", "ocr");
        } else {
          setEstado(`Leyendo "${f.name}"…`);
          fd.set("archivo", esImagen(f) ? await comprimirImagen(f, 2000, 0.85) : f);
        }
        const r = await analizarArchivo(obraId, fd);
        r.advertencias.forEach((a) => adv.push(archivos.length > 1 ? `${f.name}: ${a}` : a));
        if (r.nota) adv.push(r.nota);
        if (!r.filas.length && !r.advertencias.length) adv.push(`${f.name}: no encontré tareas con unidad y cantidad.`);
        r.filas.forEach((x) => nuevos.push({ ...x, incluir: true, vincular: !!x.plantilla, archivo: `${f.name} · ${FUENTE[r.fuente] ?? r.fuente}` }));
      } catch {
        adv.push(`${f.name}: no se pudo leer.`);
      }
    }
    setEstado(null);
    setAvisos(adv);
    setFilas((prev) => [...prev, ...nuevos]);
  }

  function leerTexto() {
    start(async () => {
      const fd = new FormData();
      fd.set("texto", texto);
      const r = await analizarArchivo(obraId, fd);
      setAvisos([...r.advertencias, ...(r.nota ? [r.nota] : [])]);
      setFilas((prev) => [...prev, ...r.filas.map((x) => ({ ...x, incluir: true, vincular: !!x.plantilla, archivo: "Texto pegado" }))]);
    });
  }

  function cambiar(i: number, c: Partial<Fila>) {
    setFilas((fs) => fs.map((f, k) => (k === i ? { ...f, ...c } : f)));
  }

  const incluidas = filas.filter((f) => f.incluir);
  const rubros = new Set(incluidas.map((f) => f.rubro)).size;
  const reconocidas = incluidas.filter((f) => f.vincular && f.plantilla).length;

  if (!abierto)
    return (
      <button type="button" onClick={() => setAbierto(true)} className="flex w-full items-center gap-4 rounded-2xl border-2 border-dashed border-brand-200 bg-brand-50/50 px-5 py-4 text-left hover:border-brand-500 hover:bg-brand-50">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-2xl shadow-sm">📄</span>
        <span className="flex-1">
          <span className="block font-semibold text-zinc-900">¿Ya tenés el presupuesto o el cómputo armado? Cargalo desde un archivo</span>
          <span className="block text-sm text-zinc-500">Excel, PDF, Word o una foto: se completan los rubros, las tareas, las cantidades y los precios.</span>
        </span>
        <span className="font-semibold text-brand-700">Cargar →</span>
      </button>
    );

  return (
    <div className="card p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-lg font-semibold">Cargar desde un archivo</div>
          <p className="muted mt-0.5">Subí tu presupuesto, cómputo o lista de tareas. Te mostramos lo que encontramos y vos confirmás antes de guardar.</p>
        </div>
        <button type="button" className="btn-ghost btn-sm" onClick={() => setAbierto(false)}>Cerrar</button>
      </div>

      <div className="mt-4 flex gap-1 rounded-xl bg-zinc-100 p-1 text-sm font-medium sm:w-fit">
        <button type="button" onClick={() => setModoEntrada("archivo")} className={`flex-1 rounded-lg px-4 py-1.5 ${modoEntrada === "archivo" ? "bg-white shadow-sm" : "text-zinc-500"}`}>Subir archivo</button>
        <button type="button" onClick={() => setModoEntrada("texto")} className={`flex-1 rounded-lg px-4 py-1.5 ${modoEntrada === "texto" ? "bg-white shadow-sm" : "text-zinc-500"}`}>Pegar texto</button>
      </div>

      {modoEntrada === "archivo" ? (
        <div
          onDragOver={(e) => { e.preventDefault(); setArrastrando(true); }}
          onDragLeave={() => setArrastrando(false)}
          onDrop={(e) => { e.preventDefault(); setArrastrando(false); const fs = Array.from(e.dataTransfer.files); if (fs.length) void procesar(fs); }}
          onClick={() => !estado && input.current?.click()}
          className={`mt-3 cursor-pointer rounded-2xl border-2 border-dashed px-5 py-8 text-center transition ${arrastrando ? "border-brand-500 bg-brand-50" : "border-zinc-200 hover:border-brand-500 hover:bg-zinc-50"}`}
        >
          <input ref={input} type="file" multiple accept={ACEPTA} className="hidden" onChange={(e) => { const fs = Array.from(e.target.files ?? []); e.target.value = ""; if (fs.length) void procesar(fs); }} />
          {estado ? (
            <div className="text-[15px] font-medium text-brand-700">{estado}</div>
          ) : (
            <>
              <div className="text-3xl">⬆️</div>
              <div className="mt-2 font-semibold">Arrastrá los archivos acá o tocá para elegirlos</div>
              <div className="mt-1 flex flex-wrap justify-center gap-1.5 text-xs">
                {["Excel .xlsx", "CSV", "PDF", "Word .docx", "Foto .jpg / .png"].map((t) => <span key={t} className="rounded-full bg-zinc-100 px-2 py-0.5 text-zinc-600">{t}</span>)}
              </div>
              <div className="mt-2 text-xs text-zinc-400">Podés subir varios a la vez. {iaDisponible ? "Las fotos y PDF escaneados se leen con IA." : "Las fotos se leen en tu navegador: que se vea derecha y nítida."}</div>
            </>
          )}
        </div>
      ) : (
        <div className="mt-3">
          <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={7} className="input font-mono text-sm" placeholder={"Pegá el listado, por ejemplo:\n\nALBAÑILERÍA\nMampostería ladrillo hueco 18  m2  145  32.500\nRevoque grueso y fino interior  m2  420  14.500\nPINTURA\nLátex interior 2 manos  m2  410"} />
          <button type="button" className="btn-secondary btn-sm mt-2" disabled={pending || !texto.trim()} onClick={leerTexto}>{pending ? "Leyendo…" : "Leer texto"}</button>
        </div>
      )}

      {avisos.map((a) => <p key={a} className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">{a}</p>)}

      {filas.length > 0 && (
        <>
          <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
            <div className="text-[15px]"><b>{incluidas.length}</b> tareas en <b>{rubros}</b> rubros · <span className="text-brand-700"><b>{reconocidas}</b> reconocidas</span> <span className="text-zinc-400">(calculan materiales, mano de obra y duración)</span></div>
            <button type="button" className="btn-ghost btn-sm text-zinc-500" onClick={() => { setFilas([]); setAvisos([]); }}>Vaciar</button>
          </div>
          <div className="mt-2 max-h-[28rem] overflow-auto rounded-xl border border-zinc-200">
            <table className="tbl">
              <thead className="sticky top-0 z-10 bg-white"><tr><th className="w-8"></th><th>Rubro</th><th>Tarea</th><th>Un.</th><th className="num">Cantidad</th><th className="num">P. unitario</th><th>Se reconoce como</th></tr></thead>
              <tbody>
                {filas.map((f, i) => (
                  <tr key={i} className={f.incluir ? "" : "opacity-40"} title={f.archivo}>
                    <td><input type="checkbox" checked={f.incluir} onChange={(e) => cambiar(i, { incluir: e.target.checked })} className="accent-brand-700" /></td>
                    <td><input value={f.rubro} onChange={(e) => cambiar(i, { rubro: e.target.value })} className="w-32 rounded border-transparent bg-transparent px-1 py-0.5 text-xs text-zinc-500 hover:border-zinc-200 focus:border-brand-500" /></td>
                    <td><input value={f.nombre} onChange={(e) => cambiar(i, { nombre: e.target.value })} className="w-full min-w-48 rounded border-transparent bg-transparent px-1 py-0.5 hover:border-zinc-200 focus:border-brand-500" /></td>
                    <td><input value={f.unidad} onChange={(e) => cambiar(i, { unidad: e.target.value })} className="w-14 rounded border-transparent bg-transparent px-1 py-0.5 hover:border-zinc-200 focus:border-brand-500" /></td>
                    <td className="num"><input value={f.cantidad} inputMode="decimal" onChange={(e) => cambiar(i, { cantidad: Number(e.target.value.replace(",", ".")) || 0 })} className={`w-20 rounded border-transparent bg-transparent px-1 py-0.5 text-right hover:border-zinc-200 focus:border-brand-500 ${!f.cantidad ? "text-amber-600" : ""}`} /></td>
                    <td className="num"><input value={f.precio ?? ""} inputMode="decimal" placeholder="—" onChange={(e) => cambiar(i, { precio: Number(e.target.value.replace(/\./g, "").replace(",", ".")) || null })} className="w-24 rounded border-transparent bg-transparent px-1 py-0.5 text-right hover:border-zinc-200 focus:border-brand-500" /></td>
                    <td className="text-xs">
                      {f.plantilla ? (
                        <label className="flex cursor-pointer items-center gap-1.5">
                          <input type="checkbox" checked={f.vincular} onChange={(e) => cambiar(i, { vincular: e.target.checked })} className="accent-brand-700" />
                          <span className={f.vincular ? "text-brand-700" : "text-zinc-400 line-through"}>{f.plantilla.nombre}</span>
                        </label>
                      ) : <span className="text-zinc-400">Tarea propia</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-zinc-500">Las reconocidas sin precio traen sus materiales y mano de obra: el precio se completa con tu lista de precios. Si el archivo trae precio, se respeta ese precio.</p>
          <div className="mt-4 flex flex-wrap items-center gap-4 text-sm">
            <label className="flex items-center gap-1.5"><input type="radio" checked={modo === "agregar"} onChange={() => setModo("agregar")} className="accent-brand-700" /> Agregar a las tareas actuales</label>
            {!demo && <label className="flex items-center gap-1.5"><input type="radio" checked={modo === "reemplazar"} onChange={() => setModo("reemplazar")} className="accent-brand-700" /> Reemplazar todas las tareas</label>}
            <button type="button" className="btn-primary ml-auto px-5" disabled={pending || !incluidas.length} onClick={() => start(async () => {
              try {
                const r = await importarPlanilla(obraId, incluidas.map((f) => ({ rubro: f.rubro, nombre: f.nombre, unidad: f.unidad, cantidad: f.cantidad, precio: f.precio, duracion: f.duracion, vincular: f.vincular })), modo);
                setResultado(`Listo: se cargaron ${r.total} tareas y ${r.vinculadas} se reconocieron.${r.conMateriales ? ` ${r.conMateriales} vinieron sin precio y ya traen sus materiales y mano de obra: completá los precios para tener el presupuesto.` : ""} El presupuesto y el cronograma ya se recalcularon.`);
                setFilas([]); setAvisos([]);
                router.refresh();
              } catch (e) { setAvisos([e instanceof Error ? e.message : "No se pudo cargar"]); }
            })}>{pending ? "Cargando…" : `Cargar ${incluidas.length} tareas`}</button>
          </div>
          {modo === "reemplazar" && <p className="mt-1 text-xs text-red-700">Se borran las tareas actuales con sus avances y dependencias.</p>}
        </>
      )}
      {resultado && (
        <div className="mt-4 rounded-xl bg-brand-50 px-4 py-3 text-[15px] text-brand-800">
          {resultado}
          <div className="mt-2 flex flex-wrap gap-3 text-sm font-semibold">
            <Link href={`/obras/${obraId}/presupuesto`} className="hover:underline">Ver presupuesto →</Link>
            <Link href={`/obras/${obraId}/gantt`} className="hover:underline">Ver cronograma →</Link>
            <Link href={`/obras/${obraId}/precios`} className="hover:underline">Completar precios →</Link>
          </div>
        </div>
      )}
    </div>
  );
}
