"use client";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronRight } from "lucide-react";
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

type Estado = "terminado" | "atrasado" | "curso" | "pendiente";
const ESTADOS: Record<Estado, { label: string; barra: string; fondo: string; texto: string }> = {
  terminado: { label: "Terminado", barra: "#2f7a62", fondo: "#cfe8de", texto: "text-brand-700" },
  curso: { label: "En curso", barra: "#3b82f6", fondo: "#dbeafe", texto: "text-blue-700" },
  atrasado: { label: "Atrasado", barra: "#ef4444", fondo: "#fee2e2", texto: "text-red-700" },
  pendiente: { label: "Por empezar", barra: "#a1a1aa", fondo: "#e4e4e7", texto: "text-zinc-500" },
};
const ZOOM = { toda: 0, semanas: 13 } as const; // "toda": se ajusta al ancho disponible
const FILA = 46;
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const addDays = (s: string, n: number) => { const d = parse(s); d.setUTCDate(d.getUTCDate() + n); return fmt(d); };
const diff = (a: string, b: string) => Math.round((parse(b).getTime() - parse(a).getTime()) / 86400000);
const corta = (s: string) => `${parse(s).getUTCDate()} ${MESES[parse(s).getUTCMonth()]}`;
const sinCodigo = (r: string) => r.replace(/^\d+\s+/, "");

function estadoDe(avance: number, previsto: number, inicio: string, fin: string, hoy: string): Estado {
  if (avance >= 100) return "terminado";
  if ((fin < hoy && avance < 100) || previsto - avance >= 15) return "atrasado";
  if (inicio <= hoy) return "curso";
  return "pendiente";
}

type Fila =
  | { tipo: "rubro"; clave: string; nombre: string; inicio: string; fin: string; avance: number; estado: Estado; n: number; abierto: boolean }
  | { tipo: "tarea"; item: GanttItem; estado: Estado; sangria: boolean };

export function Gantt({ items, hoy, editable }: { items: GanttItem[]; hoy: string; editable: boolean }) {
  const [vista, setVista] = useState<"rubros" | "tareas">("rubros");
  const [zoom, setZoom] = useState<keyof typeof ZOOM>("toda");
  const [anchoVisible, setAnchoVisible] = useState(900);
  const [abiertos, setAbiertos] = useState<Set<string>>(new Set());
  const [verDeps, setVerDeps] = useState(false);
  const [drag, setDrag] = useState<{ id: string; modo: "mover" | "estirar"; dx: number } | null>(null);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const origen = useRef<{ x: number } | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const tareas = items.filter((i) => !i.esHito);
  const { desde, hasta } = useMemo(() => {
    const ini = items.reduce((m, i) => (i.inicio < m ? i.inicio : m), items[0]?.inicio ?? hoy);
    const fin = items.reduce((m, i) => (i.fin > m ? i.fin : m), items[0]?.fin ?? hoy);
    return { desde: addDays(ini, -4), hasta: addDays(fin, 14) };
  }, [items, hoy]);
  const totalDias = diff(desde, hasta) + 1;
  const dw = zoom === "toda" ? Math.max(2.5, (anchoVisible - 70) / totalDias) : ZOOM.semanas;
  const ancho = totalDias * dw;
  const x = (d: string) => diff(desde, d) * dw;

  // ── Resumen por rubro (avance ponderado por duración) ──
  const rubros = useMemo(() => {
    const orden: string[] = [];
    const grupos = new Map<string, GanttItem[]>();
    for (const t of tareas) {
      if (!grupos.has(t.rubro)) { grupos.set(t.rubro, []); orden.push(t.rubro); }
      grupos.get(t.rubro)!.push(t);
    }
    return orden.map((clave) => {
      const ts = grupos.get(clave)!;
      const peso = (t: GanttItem) => Math.max(1, t.duracion);
      const tot = ts.reduce((a, t) => a + peso(t), 0);
      const avance = ts.reduce((a, t) => a + peso(t) * t.avanceReal, 0) / tot;
      const previsto = ts.reduce((a, t) => a + peso(t) * t.previsto, 0) / tot;
      const inicio = ts.reduce((m, t) => (t.inicio < m ? t.inicio : m), ts[0].inicio);
      const fin = ts.reduce((m, t) => (t.fin > m ? t.fin : m), ts[0].fin);
      const estado: Estado = ts.every((t) => t.avanceReal >= 100)
        ? "terminado"
        : ts.some((t) => estadoDe(t.avanceReal, t.previsto, t.inicio, t.fin, hoy) === "atrasado")
          ? "atrasado"
          : estadoDe(avance, previsto, inicio, fin, hoy);
      return { clave, nombre: sinCodigo(clave), ts, inicio, fin, avance, estado };
    });
  }, [tareas, hoy]);

  const filas: Fila[] = useMemo(() => {
    if (vista === "tareas") return tareas.map((t) => ({ tipo: "tarea", item: t, estado: estadoDe(t.avanceReal, t.previsto, t.inicio, t.fin, hoy), sangria: false }));
    const out: Fila[] = [];
    for (const r of rubros) {
      const abierto = abiertos.has(r.clave);
      out.push({ tipo: "rubro", clave: r.clave, nombre: r.nombre, inicio: r.inicio, fin: r.fin, avance: r.avance, estado: r.estado, n: r.ts.length, abierto });
      if (abierto) for (const t of r.ts) out.push({ tipo: "tarea", item: t, estado: estadoDe(t.avanceReal, t.previsto, t.inicio, t.fin, hoy), sangria: true });
    }
    return out;
  }, [vista, tareas, rubros, abiertos, hoy]);

  const fin = items.reduce((m, i) => (i.fin > m ? i.fin : m), "");
  const atrasadas = tareas.filter((t) => estadoDe(t.avanceReal, t.previsto, t.inicio, t.fin, hoy) === "atrasado").length;
  const avanceTotal = rubros.length ? rubros.reduce((a, r) => a + r.avance * r.ts.reduce((s, t) => s + Math.max(1, t.duracion), 0), 0) / Math.max(1, tareas.reduce((s, t) => s + Math.max(1, t.duracion), 0)) : 0;

  // mide el ancho disponible para la vista "Toda la obra"
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setAnchoVisible(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  // en vista por semanas, la línea de "hoy" queda a la vista
  useEffect(() => {
    const el = scroller.current;
    if (el && zoom === "semanas") el.scrollLeft = Math.max(0, x(hoy) - el.clientWidth * 0.4);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoom]);

  // encabezado: meses y semanas
  const meses: { label: string; x: number; w: number }[] = [];
  const lunes: { d: string; x: number }[] = [];
  for (let k = 0; k < totalDias; k++) {
    const d = addDays(desde, k);
    const dt = parse(d);
    if (k === 0 || dt.getUTCDate() === 1) meses.push({ label: dw < 5 ? MESES[dt.getUTCMonth()] : `${MESES[dt.getUTCMonth()]} ${dt.getUTCFullYear()}`, x: k * dw, w: 0 });
    if (dt.getUTCDay() === 1) lunes.push({ d, x: k * dw });
  }
  meses.forEach((m, k) => (m.w = (meses[k + 1]?.x ?? ancho) - m.x));

  const onDown = (e: React.PointerEvent, id: string, modo: "mover" | "estirar") => {
    if (!editable || pending) return;
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    origen.current = { x: e.clientX };
    setDrag({ id, modo, dx: 0 });
  };
  const onMove = (e: React.PointerEvent) => { if (drag && origen.current) setDrag({ ...drag, dx: e.clientX - origen.current.x }); };
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
        else await moverEnGantt(it.id, it.inicioMin, Math.max(1, habilesEntre(it.inicio, addDays(addDays(it.fin, delta), 1))));
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "No se pudo actualizar");
      } finally {
        setDrag(null);
      }
    });
  };
  const liberar = (id: string) => start(async () => { await moverEnGantt(id, null); router.refresh(); });
  const alternar = (clave: string) => setAbiertos((s) => { const n = new Set(s); if (n.has(clave)) n.delete(clave); else n.add(clave); return n; });

  const filaIdx = new Map(filas.flatMap((f, k) => (f.tipo === "tarea" ? [[f.item.id, k] as const] : [])));
  const alto = filas.length * FILA;

  // función de render (no componente) para no remontar la barra mientras se arrastra
  const barra = ({ inicio, fin: f, avance, estado, id, tarea }: { inicio: string; fin: string; avance: number; estado: Estado; id?: string; tarea?: GanttItem }) => {
    const enDrag = !!id && drag?.id === id;
    const dx = enDrag && drag.modo === "mover" ? drag.dx : 0;
    const extra = enDrag && drag.modo === "estirar" ? drag.dx : 0;
    const w = Math.max(12, (diff(inicio, f) + 1) * dw + extra);
    const c = ESTADOS[estado];
    const arrastrable = editable && !!tarea;
    return (
      <div className="absolute flex items-center" style={{ left: x(inicio) + dx, width: w, top: 11, height: FILA - 22 }}>
        <div
          className={`relative h-full w-full overflow-hidden rounded-full ${arrastrable ? "cursor-grab active:cursor-grabbing" : ""} ${enDrag ? "ring-2 ring-zinc-900/40" : ""}`}
          style={{ background: c.fondo }}
          onPointerDown={arrastrable ? (e) => onDown(e, tarea!.id, "mover") : undefined}
          title={tarea ? `${tarea.nombre}\n${corta(inicio)} → ${corta(f)} · ${tarea.duracion} días hábiles\nAvance ${Math.round(avance)}%${tarea.responsable ? `\nResponsable: ${tarea.responsable}` : ""}` : `${corta(inicio)} → ${corta(f)} · avance ${Math.round(avance)}%`}
        >
          <div className="h-full rounded-full" style={{ width: `${Math.min(100, avance)}%`, background: c.barra }} />
          {w > 48 && <span className="absolute inset-y-0 left-3 flex items-center text-xs font-semibold" style={{ color: avance > 18 ? "#fff" : c.barra }}>{Math.round(avance)}%</span>}
          {arrastrable && <div className="absolute right-0 top-0 h-full w-3 cursor-ew-resize" onPointerDown={(e) => onDown(e, tarea!.id, "estirar")} />}
        </div>
        {(zoom === "semanas" || w > 30) && <span className="ml-2 whitespace-nowrap text-xs text-zinc-500">{corta(f)}</span>}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Resumen en una línea */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <div className="card px-3 py-3 sm:px-5 sm:py-4"><div className="text-xs text-zinc-500 sm:text-sm">Avance de la obra</div><div className="text-lg font-semibold sm:text-2xl tabular-nums">{Math.round(avanceTotal)}%</div></div>
        <div className="card px-3 py-3 sm:px-5 sm:py-4"><div className="text-xs text-zinc-500 sm:text-sm">Termina</div><div className="text-lg font-semibold sm:text-2xl">{fin ? `${corta(fin)} ${parse(fin).getUTCFullYear()}` : "—"}</div></div>
        <div className="card px-3 py-3 sm:px-5 sm:py-4"><div className="text-xs text-zinc-500 sm:text-sm">Tareas atrasadas</div><div className={`text-lg font-semibold sm:text-2xl ${atrasadas ? "text-red-600" : "text-brand-700"}`}>{atrasadas || "Ninguna"}</div></div>
      </div>

      <div className="card overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 border-b border-zinc-100 px-4 py-3">
          <div className="inline-flex rounded-xl bg-zinc-100 p-1">
            {(["rubros", "tareas"] as const).map((v) => (
              <button key={v} onClick={() => setVista(v)} className={`rounded-lg px-3.5 py-1.5 text-sm font-medium ${vista === v ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500"}`}>
                {v === "rubros" ? "Por rubro" : "Todas las tareas"}
              </button>
            ))}
          </div>
          <div className="inline-flex rounded-xl bg-zinc-100 p-1">
            {(Object.keys(ZOOM) as (keyof typeof ZOOM)[]).map((z) => (
              <button key={z} onClick={() => setZoom(z)} className={`rounded-lg px-3.5 py-1.5 text-sm font-medium ${zoom === z ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500"}`}>
                {z === "toda" ? "Toda la obra" : "Semanas"}
              </button>
            ))}
          </div>
          {vista === "rubros" && (
            <button className="text-sm text-brand-700 hover:underline" onClick={() => setAbiertos(abiertos.size ? new Set() : new Set(rubros.map((r) => r.clave)))}>
              {abiertos.size ? "Cerrar rubros" : "Abrir rubros"}
            </button>
          )}
          <div className="ml-auto flex flex-wrap items-center gap-3">
            {(Object.keys(ESTADOS) as Estado[]).map((k) => (
              <span key={k} className="flex items-center gap-1.5 text-sm text-zinc-600"><span className="inline-block h-3 w-3 rounded-full" style={{ background: ESTADOS[k].barra }} />{ESTADOS[k].label}</span>
            ))}
            <label className="flex items-center gap-1.5 text-sm text-zinc-500"><input type="checkbox" checked={verDeps} onChange={(e) => setVerDeps(e.target.checked)} /> Flechas</label>
          </div>
        </div>
        {error && <div className="bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>}

        <div className="flex">
          {/* nombres */}
          <div className="w-40 shrink-0 border-r border-zinc-200 sm:w-72">
            <div className="flex h-14 items-end border-b border-zinc-200 bg-zinc-50 px-4 pb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">{vista === "rubros" ? "Rubro" : "Tarea"}</div>
            {filas.map((f) =>
              f.tipo === "rubro" ? (
                <button key={f.clave} onClick={() => alternar(f.clave)} className="flex w-full items-center gap-2 border-b border-zinc-100 px-3 text-left hover:bg-zinc-50" style={{ height: FILA }}>
                  {f.abierto ? <ChevronDown className="h-4 w-4 shrink-0 text-zinc-400" /> : <ChevronRight className="h-4 w-4 shrink-0 text-zinc-400" />}
                  <span className="min-w-0 flex-1 truncate text-[15px] font-medium">{f.nombre}</span>
                  <span className={`hidden shrink-0 text-xs font-semibold sm:inline ${ESTADOS[f.estado].texto}`}>{ESTADOS[f.estado].label}</span>
                </button>
              ) : (
                <div key={f.item.id} className={`flex items-center gap-2 border-b border-zinc-100 pr-3 ${f.sangria ? "bg-zinc-50/60 pl-9" : "pl-4"}`} style={{ height: FILA }}>
                  <span className="min-w-0 flex-1 truncate text-sm text-zinc-700" title={f.item.nombre}>{f.item.nombre}</span>
                  {editable && f.item.inicioMin && <button className="shrink-0 text-[11px] text-brand-700 hover:underline" title="Volver a la fecha automática" onClick={() => liberar(f.item.id)}>📌 auto</button>}
                </div>
              ),
            )}
          </div>

          {/* línea de tiempo */}
          <div ref={scroller} className="flex-1 overflow-x-auto" onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={() => setDrag(null)}>
            <div style={{ width: ancho }} className="relative">
              <div className="relative h-14 border-b border-zinc-200 bg-zinc-50">
                {meses.map((m) => <div key={m.x} className="absolute top-0 h-7 border-l border-zinc-200 px-2 pt-1.5 text-xs font-semibold capitalize text-zinc-700" style={{ left: m.x, width: m.w }}>{m.label}</div>)}
                {(zoom === "semanas" || dw >= 6) && lunes.map((l) => <div key={l.d} className="absolute top-7 h-7 border-l border-zinc-200 pl-1 pt-1 text-[11px] text-zinc-400" style={{ left: l.x }}>{parse(l.d).getUTCDate()}</div>)}
                <div className="absolute top-8 z-20 -translate-x-1/2 rounded-full bg-red-500 px-2 py-0.5 text-[11px] font-semibold text-white" style={{ left: x(hoy) }}>Hoy</div>
              </div>
              <div className="relative" style={{ height: alto }}>
                {(dw >= 6 ? lunes : meses.map((m) => ({ d: String(m.x), x: m.x }))).map((l) => <div key={l.d} className="absolute top-0 h-full w-px bg-zinc-100" style={{ left: l.x }} />)}
                <div className="absolute top-0 z-10 h-full w-0.5 bg-red-500/70" style={{ left: x(hoy) }} />
                {verDeps && (
                  <svg className="pointer-events-none absolute left-0 top-0" width={ancho} height={alto}>
                    {filas.flatMap((f) =>
                      f.tipo !== "tarea" ? [] : f.item.predecesoras.filter((p) => filaIdx.has(p.id)).map((p) => {
                        const pr = items.find((i) => i.id === p.id)!;
                        const x1 = p.tipo === "CC" ? x(pr.inicio) : x(pr.fin) + dw;
                        const y1 = filaIdx.get(p.id)! * FILA + FILA / 2;
                        const x2 = x(f.item.inicio);
                        const y2 = filaIdx.get(f.item.id)! * FILA + FILA / 2;
                        return <path key={f.item.id + p.id} d={`M${x1},${y1} H${x1 + 6} V${y2} H${x2}`} fill="none" stroke="#a1a1aa" strokeWidth={1} />;
                      }),
                    )}
                  </svg>
                )}
                {filas.map((f, k) => (
                  <div key={f.tipo === "rubro" ? f.clave : f.item.id} className={`absolute left-0 w-full border-b border-zinc-100 ${f.tipo === "tarea" && f.sangria ? "bg-zinc-50/40" : ""}`} style={{ top: k * FILA, height: FILA }}>
                    {f.tipo === "rubro"
                      ? barra({ inicio: f.inicio, fin: f.fin, avance: f.avance, estado: f.estado })
                      : barra({ inicio: f.item.inicio, fin: f.item.fin, avance: f.item.avanceReal, estado: f.estado, id: f.item.id, tarea: f.item })}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
        {editable && (vista === "tareas" || abiertos.size > 0) && (
          <div className="border-t border-zinc-100 px-4 py-2.5 text-sm text-zinc-500">{pending ? "Recalculando el cronograma…" : "Arrastrá una tarea para cambiar su fecha, o su borde derecho para cambiar la duración. Las tareas que dependen de ella se corren solas."}</div>
        )}
      </div>
    </div>
  );
}
