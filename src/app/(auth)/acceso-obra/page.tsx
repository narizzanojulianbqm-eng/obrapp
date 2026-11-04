"use client";
import { useActionState } from "react";
import Link from "next/link";
import { ingresarConDni } from "@/app/actions/auth";

export default function AccesoObra() {
  const [state, action, pending] = useActionState(ingresarConDni, undefined);
  const inp = "block w-full rounded-2xl border-2 border-zinc-300 bg-white px-5 py-4 text-center text-2xl tracking-widest focus:border-brand-500 focus:outline-none";
  return (
    <>
      <h1 className="mb-1 text-3xl font-bold tracking-tight">Equipo de obra</h1>
      <p className="mb-8 text-lg text-zinc-500">Entrá con tu DNI y el PIN que te dio el arquitecto.</p>
      <form action={action} className="space-y-5">
        <label className="block">
          <span className="mb-2 block text-lg font-medium">DNI</span>
          <input name="dni" inputMode="numeric" autoComplete="username" required className={inp} placeholder="30123456" />
        </label>
        <label className="block">
          <span className="mb-2 block text-lg font-medium">PIN (6 números)</span>
          <input name="pin" type="password" inputMode="numeric" maxLength={6} autoComplete="current-password" required className={inp} placeholder="••••••" />
        </label>
        {state?.error && <p className="rounded-xl bg-red-50 px-4 py-3 text-base text-red-700">{state.error}</p>}
        <button className="btn-primary w-full py-4 text-lg" disabled={pending}>{pending ? "Entrando…" : "Entrar"}</button>
      </form>
      <p className="mt-6 text-center text-zinc-500">¿Sos arquitecto o cliente? <Link href="/login" className="font-medium text-brand-700 hover:underline">Entrá con tu email</Link></p>
    </>
  );
}
