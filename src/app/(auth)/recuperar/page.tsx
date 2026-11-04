import Link from "next/link";
import { ActionForm } from "@/components/forms/form-state";
import { restablecerContrasena, solicitarRecuperacion } from "@/app/actions/auth";

export default async function Recuperar({ searchParams }: { searchParams: Promise<{ email?: string; t?: string }> }) {
  const { email, t } = await searchParams;
  return (
    <>
      <h1 className="h1 mb-1">Recuperar contraseña</h1>
      {!t && (
        <>
          <p className="muted mb-5">Te mandamos un link por email y, si tenés WhatsApp vinculado, un código de 6 dígitos.</p>
          <ActionForm action={solicitarRecuperacion} submitLabel="Enviar" submitClass="btn-primary w-full">
            <label className="block"><span className="label">Email de tu cuenta</span><input name="email" type="email" className="input" required defaultValue={email} /></label>
          </ActionForm>
          <div className="my-6 border-t border-zinc-200" />
          <p className="muted mb-3 text-sm">¿Ya tenés el código de WhatsApp?</p>
        </>
      )}
      <ActionForm action={restablecerContrasena} submitLabel="Guardar nueva contraseña" submitClass={t ? "btn-primary w-full" : "btn-secondary w-full"}>
        <div className="space-y-3">
          <label className="block"><span className="label">Email</span><input name="email" type="email" className="input" required defaultValue={email} readOnly={!!t} /></label>
          {t ? <input type="hidden" name="codigo" value={t} /> : <label className="block"><span className="label">Código de 6 dígitos</span><input name="codigo" inputMode="numeric" className="input" required maxLength={6} /></label>}
          <label className="block"><span className="label">Nueva contraseña</span><input name="password" type="password" className="input" required minLength={8} autoComplete="new-password" /></label>
        </div>
      </ActionForm>
      <p className="mt-5 text-center text-sm"><Link href="/login" className="text-brand-700 hover:underline">Volver a ingresar</Link></p>
    </>
  );
}
