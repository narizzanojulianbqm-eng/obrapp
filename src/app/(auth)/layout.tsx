export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="hidden flex-col justify-between bg-zinc-900 p-10 text-zinc-100 lg:flex">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-brand-500 text-sm font-bold">O</div>
          <span className="text-lg font-semibold">Obrapp</span>
        </div>
        <div className="max-w-md">
          <h2 className="text-3xl font-semibold leading-tight tracking-tight">El sistema operativo de tu obra.</h2>
          <p className="mt-4 text-zinc-400">Rubros, cómputos, análisis de precios, presupuesto y Gantt generados a partir de los datos de la obra. Clientes y obreros conectados en el mismo lugar.</p>
        </div>
        <div className="text-xs text-zinc-500">Hecho para la producción de obra en Argentina.</div>
      </div>
      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">{children}</div>
      </div>
    </div>
  );
}
