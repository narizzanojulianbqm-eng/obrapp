"use client";
import Link from "next/link";
import { useEffect, useState } from "react";

/** Tarjeta de bienvenida para quien entra a la demo sin cuenta: qué probar primero. Se puede cerrar. */
export function DemoGuia({ clave, titulo, pasos }: { clave: string; titulo: string; pasos: { texto: string; href: string }[] }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    try { setVisible(!localStorage.getItem(`obrapp_guia_${clave}`)); } catch { setVisible(true); }
  }, [clave]);
  if (!visible) return null;
  const cerrar = () => { setVisible(false); try { localStorage.setItem(`obrapp_guia_${clave}`, "1"); } catch {} };
  return (
    <div className="relative mb-6 rounded-2xl bg-zinc-900 p-5 text-white">
      <button type="button" onClick={cerrar} className="absolute right-3 top-3 rounded-full px-2 text-lg text-white/60 hover:text-white" aria-label="Cerrar">×</button>
      <div className="text-xs font-semibold uppercase tracking-wide text-emerald-300">Estás en la demo</div>
      <div className="mt-1 text-lg font-semibold">{titulo}</div>
      <ol className="mt-3 grid gap-2 sm:grid-cols-3">
        {pasos.map((p, i) => (
          <li key={p.href}>
            <Link href={p.href} className="flex h-full items-start gap-3 rounded-xl bg-white/10 px-3 py-3 text-[15px] hover:bg-white/15">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-400 text-xs font-bold text-zinc-900">{i + 1}</span>
              <span>{p.texto}</span>
            </Link>
          </li>
        ))}
      </ol>
      <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
        <a href="/registro" className="rounded-lg bg-white px-3 py-1.5 font-semibold text-zinc-900 hover:bg-zinc-100">Crear mi cuenta gratis</a>
        <span className="text-white/60">Los datos son ficticios: podés tocar todo.</span>
      </div>
    </div>
  );
}
