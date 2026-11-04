"use client";
import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Mic, Paperclip, Send } from "lucide-react";
import type { FormState } from "@/app/actions/auth";
import { comprimirInput } from "@/components/archivo-input";

export function SimuladorInput({ action, ejemplos }: { action: (s: FormState, f: FormData) => Promise<FormState>; ejemplos: string[] }) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const ref = useRef<HTMLFormElement>(null);
  const [texto, setTexto] = useState("");
  const [archivo, setArchivo] = useState<string | null>(null);
  const router = useRouter();
  useEffect(() => {
    if (state?.ok) { ref.current?.reset(); setTexto(""); setArchivo(null); router.refresh(); }
  }, [state, router]);
  return (
    <div className="border-t border-black/5 bg-[#f0f2f5] p-2">
      <div className="mb-2 flex gap-1.5 overflow-x-auto pb-1">
        {ejemplos.map((e) => (
          <button key={e} type="button" onClick={() => setTexto(e)} className="shrink-0 rounded-full border border-zinc-300 bg-white px-2.5 py-1 text-xs text-zinc-700 hover:bg-zinc-50">{e}</button>
        ))}
      </div>
      <form ref={ref} action={formAction} className="flex items-end gap-2">
        <label className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full text-zinc-500 hover:bg-black/5" title="Adjuntar foto, audio o documento">
          <Paperclip className="h-5 w-5" />
          <input type="file" name="archivo" accept="image/*,audio/*,video/*,.pdf,.doc,.docx,.xls,.xlsx" className="hidden" onChange={async (e) => { const el = e.currentTarget; setArchivo(el.files?.[0]?.name ?? null); await comprimirInput(el); }} />
        </label>
        <div className="flex-1">
          {archivo && <div className="mb-1 truncate text-xs text-zinc-600">📎 {archivo}</div>}
          <textarea
            name="texto" rows={1} value={texto} onChange={(e) => setTexto(e.target.value)}
            placeholder="Escribí un mensaje"
            className="block w-full resize-none rounded-lg border-0 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-0"
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); ref.current?.requestSubmit(); } }}
          />
        </div>
        <button disabled={pending} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#00a884] text-white disabled:opacity-50" aria-label="Enviar">
          {texto || archivo ? <Send className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
        </button>
      </form>
      {state?.error && <p className="mt-1 text-xs text-red-600">{state.error}</p>}
      {pending && <p className="mt-1 text-xs text-zinc-500">Procesando…</p>}
    </div>
  );
}

/** Botones / lista interactiva de WhatsApp en el simulador (solo en el último mensaje). */
export function OpcionesWA({ action, opciones }: { action: (s: FormState, f: FormData) => Promise<FormState>; opciones: { id: string; titulo: string }[] }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  return (
    <div className="mt-1 grid gap-1">
      {opciones.map((o) => (
        <button
          key={o.id}
          disabled={pending}
          className="rounded-lg bg-white px-3 py-1.5 text-center text-sm font-medium text-[#008069] shadow-sm hover:bg-zinc-50 disabled:opacity-50"
          onClick={async () => {
            setPending(true);
            const fd = new FormData();
            fd.set("texto", o.id.startsWith("op:") ? o.id.slice(3) : o.titulo);
            await action(undefined, fd);
            setPending(false);
            router.refresh();
          }}
        >
          {o.titulo}
        </button>
      ))}
    </div>
  );
}
