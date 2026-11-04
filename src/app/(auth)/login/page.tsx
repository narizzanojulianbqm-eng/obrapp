import { iniciarSesion } from "@/app/actions/auth";
import { AuthForm } from "../auth-form";
import { DEMO_CUENTAS, modoDemo } from "@/lib/entorno";

export default async function Login({ searchParams }: { searchParams: Promise<{ next?: string; ok?: string }> }) {
  const { next, ok } = await searchParams;
  return (
    <>
      <h1 className="h1 mb-1">Ingresar</h1>
      <p className="muted mb-6">Accedé a tus obras.</p>
      {ok && <p className="mb-4 rounded-md bg-brand-50 px-3 py-2 text-sm text-brand-700">{ok}</p>}
      <AuthForm modo="login" action={iniciarSesion} next={next} />
      {modoDemo() && (
        <div className="mt-8 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <div className="text-sm font-medium text-amber-900">Entorno de prueba</div>
          <p className="mt-1 text-xs text-amber-800">Entrá con un perfil de demostración (datos ficticios). Contraseña: <b>demo1234</b></p>
          <div className="mt-3 space-y-2">
            {DEMO_CUENTAS.map((c) => (
              <form key={c.email} action={async (fd: FormData) => { "use server"; await iniciarSesion(undefined, fd); }}>
                <input type="hidden" name="email" value={c.email} />
                <input type="hidden" name="password" value="demo1234" />
                <button className="flex w-full items-center justify-between rounded-lg border border-amber-200 bg-white px-3 py-2 text-left hover:bg-amber-100/50">
                  <span><span className="block text-sm font-medium text-zinc-900">Entrar como {c.label}</span><span className="block text-xs text-zinc-500">{c.detalle}</span></span>
                  <span className="text-zinc-400">→</span>
                </button>
              </form>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
