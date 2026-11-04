"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { actualizarItem, agregarPredecesora, quitarPredecesora, usarDuracionCalculada } from "@/app/actions/obra";

export function AsignarSelect({ itemId, value, miembros }: { itemId: string; value: string | null; miembros: { id: string; nombre: string }[] }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <select
      className="input-sm max-w-[10rem]"
      disabled={pending}
      value={value ?? ""}
      onChange={(e) => start(async () => { await actualizarItem(itemId, { asignadoA: e.target.value || null }); router.refresh(); })}
    >
      <option value="">Sin asignar</option>
      {miembros.map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
    </select>
  );
}

export function DependenciasEditor({
  itemId,
  preds,
  opciones,
  duracionManual,
}: {
  itemId: string;
  preds: { id: string; nombre: string; tipo: string; desfase: number }[];
  opciones: { id: string; nombre: string }[];
  duracionManual: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const run = (fn: () => Promise<unknown>) => start(async () => { setError(null); try { await fn(); router.refresh(); } catch (e) { setError(e instanceof Error ? e.message : "Error"); } });
  return (
    <div>
      <button type="button" className="text-xs text-zinc-500 hover:text-zinc-900" onClick={() => setOpen(!open)}>
        {preds.length ? `${preds.length} dep.` : "sin dep."} {open ? "▴" : "▾"}
      </button>
      {open && (
        <div className="mt-2 w-80 space-y-2 rounded-lg border border-zinc-200 bg-white p-3 text-xs shadow-sm">
          <div className="font-medium text-zinc-700">Depende de</div>
          {preds.length === 0 && <div className="text-zinc-400">Ninguna: arranca al inicio de obra.</div>}
          {preds.map((p) => (
            <div key={p.id} className="flex items-center justify-between gap-2">
              <span className="truncate">{p.nombre} <span className="text-zinc-400">({p.tipo === "CC" ? "comienzo-comienzo" : "fin-comienzo"}{p.desfase ? ` ${p.desfase > 0 ? "+" : ""}${p.desfase}d` : ""})</span></span>
              <button className="text-red-600 hover:underline" disabled={pending} onClick={() => run(() => quitarPredecesora(itemId, p.id))}>quitar</button>
            </div>
          ))}
          <form action={(fd) => run(() => agregarPredecesora(itemId, fd))} className="space-y-1.5 border-t border-zinc-100 pt-2">
            <select name="predId" className="input-sm w-full" required defaultValue="">
              <option value="" disabled>Agregar dependencia…</option>
              {opciones.filter((o) => o.id !== itemId && !preds.some((p) => p.id === o.id)).map((o) => <option key={o.id} value={o.id}>{o.nombre}</option>)}
            </select>
            <div className="flex gap-1.5">
              <select name="tipo" className="input-sm flex-1"><option value="FC">Fin → comienzo</option><option value="CC">Comienzo → comienzo (solapada)</option></select>
              <input name="desfase" type="number" className="input-sm w-16" placeholder="±d" title="Desfase en días hábiles" />
              <button className="btn-secondary btn-sm" disabled={pending}>+</button>
            </div>
          </form>
          {duracionManual && <button className="text-brand-700 hover:underline" onClick={() => run(() => usarDuracionCalculada(itemId))}>Volver a duración calculada por rendimiento</button>}
          {error && <div className="text-red-600">{error}</div>}
        </div>
      )}
    </div>
  );
}
