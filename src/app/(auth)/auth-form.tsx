"use client";
import { useActionState } from "react";
import Link from "next/link";
import type { FormState } from "@/app/actions/auth";

export function AuthForm({ modo, action, next }: { modo: "login" | "registro"; action: (s: FormState, f: FormData) => Promise<FormState>; next?: string }) {
  const [state, formAction, pending] = useActionState(action, undefined);
  return (
    <form action={formAction} className="space-y-4">
      {modo === "registro" && (
        <label className="block">
          <span className="label">Nombre y apellido</span>
          <input name="nombre" className="input" required autoComplete="name" />
        </label>
      )}
      <label className="block">
        <span className="label">Email</span>
        <input name="email" type="email" className="input" required autoComplete="email" />
      </label>
      <label className="block">
        <span className="label">Contraseña</span>
        <input name="password" type="password" className="input" required minLength={modo === "registro" ? 8 : 1} autoComplete={modo === "login" ? "current-password" : "new-password"} />
      </label>
      {next && <input type="hidden" name="next" value={next} />}
      {state?.error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
      {modo === "login" && <div className="text-right text-xs"><Link href="/recuperar" className="text-zinc-500 hover:text-zinc-900">¿Olvidaste tu contraseña?</Link></div>}
      <button className="btn-primary w-full" disabled={pending}>
        {pending ? "Un momento…" : modo === "login" ? "Ingresar" : "Crear cuenta"}
      </button>
      <p className="text-center text-sm text-zinc-500">
        {modo === "login" ? (
          <>¿No tenés cuenta? <Link href="/registro" className="font-medium text-brand-700 hover:underline">Registrate</Link></>
        ) : (
          <>¿Ya tenés cuenta? <Link href="/login" className="font-medium text-brand-700 hover:underline">Ingresá</Link></>
        )}
      </p>
    </form>
  );
}
