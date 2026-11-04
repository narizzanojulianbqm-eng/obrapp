"use client";
import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { moverEnGantt } from "@/app/actions/obra";
import { habilesEntre, parse, fmt } from "@/lib/engine/calendario";

export type GanttItem = {
  id: string;
  nombre: string;
  rubro: string;
  inicio: string;
  fin: string;
  duracion: number;
  esHito: boolean;
  avanceReal: number;
  previsto: number;
  inicioMin: string | null;
  predecesoras: { id: string; tipo: string }[];
  responsable?: string;
};

const ZOOM = { dia: 26, semana: 11, mes: 4 } as const;
const ROW = 30;
const addDays = (s: string, n: number) => { const d = parse(s); d.setUTCDate(d.getUTCDate() + n); return fmt(d); };
const diff = (a: string, b: string) => Math.round((parse(b).getTime() - parse(a).getTime()) / 86400000);
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

export function Gantt({ items, hoy, editable }: { items: GanttItem[]; hoy: string; editable: boolean }) {
  const [zoom, setZoom] = useState<keyof typeof ZOOM>("semana");
  const [drag, setDrag] = useState<{ id: string; modo: "mover" | "estirar"; dx: number } | null>(null);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [verDeps, setVerDeps] = useState(true);
  const router = useRouter();
  const origen = useRef<{ x: number } | null>(null);
  const dw = ZOOM[zoom];

  const { desde, hasta } = useMemo(() => {
    const ini = items.reduce((m, i) => (i.inicio < m ? i.inicio : m), items[0]?.inicio ?? hoy);
    const fin = items.reduce((m, i) => (i.fin > m ? i.fin : m), items[0]?.fin ?? hoy);
    return { desde: addDays(ini, -3), hasta: addDays(fin, 10) };
  }, [items, hoy]);
  const totalDias = diff(desde, hasta) + 1;
  const x = (d: string) => diff(desde, d) * dw;
  const idx = new Map(items.map((i, k) => [i.id, k]));

  // encabezados
  const meses: { label: string; x: number; w: number }[] = [];
  const dias: { d: string; finde: boolean }[] = [];
  for (let k = 0; k < totalDias; k++) {
    const d = addDays(desde, k);
    const dt = parse(d);
    dias.push({ d, finde: dt.getUTCDay() === 0 || dt.getUTCDay() === 6 });
    if (k === 0 || dt.getUTCDate() === 1) meses.push({ label: `${MESES[dt.getUTCMonth()]} ${String(dt.getUTCFullYear()).slice(2)}`, x: k * dw, w: 0 });
  }
  meses.forEach((m, k) => (m.w = (meses[k + 1]?.x ?? totalDias * dw) - m.x));

  const onDown = (e: React.PointerEvent, id: string, modo: "mover" | "estirar") => {
    if (!editable || pending) return;
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    origen.current = { x: e.clientX };
    setDrag({ id, modo, dx: 0 });
  };
  const onMove = (e: React.PointerEvent) => {
    if (!drag || !origen.current) return;
    setDrag({ ...drag, dx: e.clientX - origen.current.x });
  };
  const onUp = () => {
    if (!drag) return;
    const it = items.find((i) => i.id === drag.id)!;
    const delta = Math.round(drag.dx / dw);
    origen.current = null;
    if (delta === 0) return setDrag(null);
    start(async () => {
      setError(null);
      try {
        if (drag.modo === "mover") await moverEnGantt(it.id, addDays(it.inicio, delta));
        else {
          const nuevoFin = addDays(it.fin, delta);
          const dur = Math.max(1, habilesEntre(it.inicio, addDays(nuevoFin, 1)));
          await moverEnGantt(it.id, it.inicioMin, dur);
        }
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "No se pudo actualizar");
      } finally {
        setDrag(null);
      }
    });
  };

  const liberar = (id: string) => start(async () => { await moverEnGantt(id, null); router.refresh(); });

  let rubroAnterior = "";
  const ancho = totalDias * dw;
  const alto = items.length * ROW;

  return (
    <div className="card overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 border-b border-zinc-100 px-4 py-2.5 text-sm">
        <div className="inline-flex rounded-lg border border-zinc-200 p-0.5">
          {(Object.keys(ZOOM) as (keyof typeof ZOOM)[]).map((z) => (
            <button key={z} onClick={() => setZoom(z)} className={`rounded-md px-2.5 py-1 text-xs ${zoom === z ? "bg-zinc-900 text-white" : "text-zinc-600 hover:bg-zinc-100"}`}>
              {z === "dia" ? "Días" : z === "semana" ? "Semanas" : "Meses"}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-1.5 text-xs text-zinc-600"><input type="checkbox" checked={verDeps} onChange={(e) => setVerDeps(e.target.checked)} /> Dependencias</label>
        <div className="flex items-center gap-3 text-xs text-zinc-500">
          <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-5 rounded-sm bg-zinc-300" /> Planificado</span>
          <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-5 rounded-sm bg-brand-500" /> Avance real</span>
          <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-5 rounded-sm bg-red-400" /> Atrasada</span>
          <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rotate-45 bg-amber-500" /> Hito</span>
        </div>
        {editable && <span className="ml-auto text-xs text-zinc-400">{pending ? "Recalculando cronograma…" : "Arrastrá una barra para moverla o su borde derecho para cambiar la duración"}</span>}
      </div>
      {error && <div className="bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>}
      <div className="flex">
        {/* columna de nombres */}
        <div className="w-72 shrink-0 border-r border-zinc-200">
          <div className="h-12 border-b border-zinc-200 bg-zinc-50 px-3 pt-6 text-xs font-medium uppercase tracking-wide text-zinc-500">Actividad</div>
          {items.map((i) => {
            const nuevoRubro = i.rubro !== rubroAnterior;
            rubroAnterior = i.rubro;
            return (
              <div key={i.id} className={`flex items-center gap-2 px-3 text-xs ${nuevoRubro ? "border-t border-zinc-200" : ""}`} style={{ height: ROW }}>
                <div className="min-w-0 flex-1">
                  {nuevoRubro && <div className="truncate text-[10px] font-semibold uppercase tracking-wide text-zinc-400">{i.rubro}</div>}
                  <div className={`truncate ${i.esHito ? "font-medium text-amber-800" : "text-zinc-800"}`} title={i.nombre}>{i.nombre}</div>
                </div>
                {editable && i.inicioMin && (
                  <button className="shrink-0 text-[10px] text-brand-700 hover:underline" title={`Fijada a no antes de ${i.inicioMin}`} onClick={() => liberar(i.id)}>📌 liberar</button>
                )}
              </div>
            );
          })}
        </div>
        {/* línea de tiempo */}
        <div className="flex-1 overflow-x-auto" onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={() => setDrag(null)}>
          <div style={{ width: ancho }} className="relative">
            <div className="sticky top-0 h-12 border-b border-zinc-200 bg-zinc-50">
              {meses.map((m) => (
                <div key={m.x} className="absolute top-0 h-6 border-l border-zinc-200 px-1.5 pt-1 text-[11px] font-medium text-zinc-600" style={{ left: m.x, width: m.w }}>{m.label}</div>
              ))}
              {zoom !== "mes" && dias.map((d, k) => (zoom === "dia" || parse(d.d).getUTCDay() === 1) && (
                <div key={d.d} className="absolute top-6 h-6 border-l border-zinc-100 pl-0.5 pt-1 text-[10px] text-zinc-400" style={{ left: k * dw }}>{parse(d.d).getUTCDate()}</div>
              ))}
            </div>
            <div className="relative" style={{ height: alto }}>
              {zoom !== "mes" && dias.map((d, k) => d.finde && <div key={d.d} className="absolute top-0 h-full bg-zinc-50" style={{ left: k * dw, width: dw }} />)}
              <div className="absolute top-0 z-10 h-full w-px bg-red-500/70" style={{ left: x(hoy) + dw / 2 }} title="Hoy" />
              {verDeps && (
                <svg className="pointer-events-none absolute left-0 top-0" width={ancho} height={alto}>
                  {items.flatMap((i) =>
                    i.predecesoras.filter((p) => idx.has(p.id)).map((p) => {
                      const pr = items[idx.get(p.id)!];
                      const x1 = p.tipo === "CC" ? x(pr.inicio) : x(pr.fin) + (pr.esHito ? dw / 2 : dw);
                      const y1 = idx.get(p.id)! * ROW + ROW / 2;
                      const x2 = x(i.inicio) + (i.esHito ? dw / 2 - 5 : 0);
                      const y2 = idx.get(i.id)! * ROW + ROW / 2;
                      const mid = Math.max(x1 + 4, Math.min(x2 - 4, x1 + 6));
                      return <path key={i.id + p.id} d={`M${x1},${y1} H${mid} V${y2} H${x2}`} fill="none" stroke="#a1a1aa" strokeWidth={1} markerEnd="url(#flecha)" opacity={0.7} />;
                    }),
                  )}
                  <defs><marker id="flecha" viewBox="0 0 6 6" refX="6" refY="3" markerWidth="5" markerHeight="5" orient="auto"><path d="M0,0 L6,3 L0,6 z" fill="#a1a1aa" /></marker></defs>
                </svg>
              )}
              {items.map((i, k) => {
                const enDrag = drag?.id === i.id;
                const dx = enDrag && drag.modo === "mover" ? drag.dx : 0;
                const dwExtra = enDrag && drag.modo === "estirar" ? drag.dx : 0;
                const left = x(i.inicio) + dx;
                const top = k * ROW;
                if (i.esHito)
                  return (
                    <div key={i.id} className="absolute flex items-center" style={{ left: left + dw / 2 - 6, top, height: ROW }} title={`${i.nombre}: ${i.inicio}`}>
                      <div className={`h-3 w-3 rotate-45 ${editable ? "cursor-grab" : ""} bg-amber-500`} onPointerDown={(e) => onDown(e, i.id, "mover")} />
                      <span className="ml-2 whitespace-nowrap text-[10px] text-amber-800">{i.inicio.slice(8)}/{i.inicio.slice(5, 7)}</span>
                    </div>
                  );
                const w = Math.max(dw, (diff(i.inicio, i.fin) + 1) * dw + dwExtra);
                const atrasada = i.previsto - i.avanceReal >= 15 || (i.fin < hoy && i.avanceReal < 100);
                return (
                  <div key={i.id} className="absolute" style={{ left, top: top + 7, width: w, height: ROW - 14 }}>
                    <div
                      className={`group relative h-full overflow-hidden rounded ${atrasada ? "bg-red-200" : "bg-zinc-300"} ${editable ? "cursor-grab active:cursor-grabbing" : ""} ${enDrag ? "ring-2 ring-brand-500" : ""}`}
                      onPointerDown={(e) => onDown(e, i.id, "mover")}
                      title={`${i.nombre}\n${i.inicio} → ${i.fin} (${i.duracion} días hábiles)\nAvance real ${i.avanceReal}% · previsto ${i.previsto.toFixed(0)}%${i.responsable ? `\nResponsable: ${i.responsable}` : ""}`}
                    >
                      <div className={`h-full ${atrasada ? "bg-red-400" : "bg-brand-500"}`} style={{ width: `${i.avanceReal}%` }} />
                      {editable && <div className="absolute right-0 top-0 h-full w-2 cursor-ew-resize bg-black/0 hover:bg-black/20" onPointerDown={(e) => onDown(e, i.id, "estirar")} />}
                    </div>
                    {w > 60 && <span className="pointer-events-none absolute left-1.5 top-0 text-[10px] font-medium leading-4 text-white mix-blend-difference">{i.avanceReal > 0 ? `${i.avanceReal}%` : ""}</span>}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
