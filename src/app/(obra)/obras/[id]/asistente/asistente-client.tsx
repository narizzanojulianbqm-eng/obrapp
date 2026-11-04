"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Send } from "lucide-react";
import { preguntarIA } from "@/app/actions/ia";

export function Pregunta({ obraId, sugerencias }: { obraId: string; sugerencias: string[] }) {
  const [q, setQ] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();
  const enviar = (texto: string) => {
    if (!texto.trim()) return;
    start(async () => { await preguntarIA(obraId, texto); setQ(""); router.refresh(); });
  };
  return (
    <div className="border-t border-zinc-200 p-3">
      <div className="mb-2 flex flex-wrap gap-1.5">
        {sugerencias.map((s) => <button key={s} disabled={pending} onClick={() => enviar(s)} className="rounded-full border border-zinc-200 px-2.5 py-1 text-xs text-zinc-600 hover:bg-zinc-50">{s}</button>)}
      </div>
      <form onSubmit={(e) => { e.preventDefault(); enviar(q); }} className="flex gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} className="input flex-1" placeholder="Preguntá o pedí algo sobre la obra…" disabled={pending} />
        <button className="btn-primary" disabled={pending}>{pending ? "Pensando…" : <Send className="h-4 w-4" />}</button>
      </form>
    </div>
  );
}
