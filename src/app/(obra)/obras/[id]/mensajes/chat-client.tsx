"use client";
import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Paperclip, Send } from "lucide-react";
import type { FormState } from "@/app/actions/auth";
import { comprimirInput } from "@/components/archivo-input";

export function Composer({ action, puedeDecision }: { action: (s: FormState, f: FormData) => Promise<FormState>; puedeDecision: boolean }) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state?.ok) ref.current?.reset(); }, [state]);
  return (
    <form ref={ref} action={formAction} className="border-t border-zinc-200 p-3">
      <div className="flex items-end gap-2">
        <textarea
          name="texto"
          rows={2}
          className="input flex-1 resize-none"
          placeholder="Escribí un mensaje…"
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); (e.currentTarget.form as HTMLFormElement).requestSubmit(); } }}
        />
        <button className="btn-primary h-10" disabled={pending} aria-label="Enviar"><Send className="h-4 w-4" /></button>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-zinc-600">
        <select name="tipo" className="input-sm text-xs" defaultValue="mensaje">
          <option value="mensaje">Mensaje</option>
          <option value="observacion">Observación (planos / documentación)</option>
          <option value="cambio">Solicitud de modificación</option>
          {puedeDecision && <option value="decision">Registrar decisión</option>}
        </select>
        <label className="flex cursor-pointer items-center gap-1 hover:text-zinc-900"><Paperclip className="h-3.5 w-3.5" /> Adjuntar<input type="file" name="adjuntos" multiple className="hidden" onChange={(e) => comprimirInput(e.currentTarget)} /></label>
        {state?.error && <span className="text-red-600">{state.error}</span>}
      </div>
    </form>
  );
}

export function AutoRefresh({ ms = 15000 }: { ms?: number }) {
  const router = useRouter();
  useEffect(() => { const t = setInterval(() => router.refresh(), ms); return () => clearInterval(t); }, [router, ms]);
  return null;
}

export function ScrollAbajo() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // desplaza solo el contenedor del chat, no la página
    const cont = ref.current?.parentElement;
    if (cont) cont.scrollTop = cont.scrollHeight;
  });
  return <div ref={ref} />;
}
