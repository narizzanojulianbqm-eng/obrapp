"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { importarPlanilla, previsualizarPlanilla } from "@/app/actions/obra";

type Fila = { rubro: string; nombre: string; unidad: string; cantidad: number; precio: number | null; duracion: number | null };

export function ImportarPlanilla({ obraId }: { obraId: string }) {
  const [abierto, setAbierto] = useState(false);
  const [filas, setFilas] = useState<Fila[]>([]);
  const [adv, setAdv] = useState<string[]>([]);
  const [modo, setModo] = useState<"agregar" | "reemplazar">("agregar");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  if (!abierto) return <button className="btn-secondary" onClick={() => setAbierto(true)}>Importar planilla (Excel / CSV)</button>;
  return (
    <div className="card w-full p-5">
      <div className="flex items-center justify-between"><div className="h2">Importar planilla existente</div><button className="btn-ghost btn-sm" onClick={() => setAbierto(false)}>Cerrar</button></div>
      <p className="muted mt-1">Columnas reconocidas: <b>Rubro</b>, <b>Descripción</b> (o Ítem / Tarea), <b>Unidad</b>, <b>Cantidad</b> y opcionalmente <b>Precio unitario</b> y <b>Duración</b>. Las filas sin unidad ni cantidad se toman como títulos de rubro.</p>
      <form className="mt-3 flex flex-wrap items-center gap-2" action={(fd) => start(async () => { setMsg(null); const r = await previsualizarPlanilla(obraId, fd); setFilas(r.filas); setAdv(r.advertencias); })}>
        <input type="file" name="archivo" accept=".xlsx,.csv,.txt" required className="text-sm" />
        <button className="btn-secondary btn-sm" disabled={pending}>{pending ? "Leyendo…" : "Previsualizar"}</button>
      </form>
      {adv.map((a) => <p key={a} className="mt-2 text-sm text-amber-700">{a}</p>)}
      {filas.length > 0 && (
        <>
          <div className="mt-3 max-h-72 overflow-auto rounded-lg border border-zinc-200">
            <table className="tbl">
              <thead><tr><th>Rubro</th><th>Descripción</th><th>Un.</th><th className="num">Cant.</th><th className="num">P. unit.</th><th className="num">Días</th></tr></thead>
              <tbody>{filas.map((f, i) => <tr key={i}><td className="text-xs text-zinc-500">{f.rubro}</td><td>{f.nombre}</td><td>{f.unidad}</td><td className="num">{f.cantidad}</td><td className="num">{f.precio ?? "—"}</td><td className="num">{f.duracion ?? "—"}</td></tr>)}</tbody>
            </table>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
            <label className="flex items-center gap-1.5"><input type="radio" checked={modo === "agregar"} onChange={() => setModo("agregar")} /> Agregar a los rubros actuales</label>
            <label className="flex items-center gap-1.5"><input type="radio" checked={modo === "reemplazar"} onChange={() => setModo("reemplazar")} /> Reemplazar todos los rubros</label>
            <button className="btn-primary btn-sm ml-auto" disabled={pending} onClick={() => {
              start(async () => { try { const n = await importarPlanilla(obraId, filas, modo); setMsg(`Se importaron ${n} ítems. Cómputo, presupuesto y Gantt recalculados.`); setFilas([]); router.refresh(); } catch (e) { setMsg(e instanceof Error ? e.message : "Error"); } });
            }}>{pending ? "Importando…" : `Importar ${filas.length} ítems`}</button>
          </div>
          {modo === "reemplazar" && <p className="mt-1 text-xs text-red-700">Se eliminarán los rubros, ítems, avances y dependencias actuales de la obra.</p>}
        </>
      )}
      {msg && <p className="mt-3 rounded-md bg-brand-50 px-3 py-2 text-sm text-brand-700">{msg}</p>}
    </div>
  );
}
