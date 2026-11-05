"use client";
import { useEffect, useRef, useState } from "react";

type Pestana = "que" | "como" | "soluciona" | "video";
const EVENTO = "obrapp:presentacion";
const VISTO = "obrapp_presentacion_vista";

/** Botón que abre la ventana de presentación (en la pestaña indicada). */
export function AbrirPresentacion({ pestana = "que", className, children }: { pestana?: Pestana; className?: string; children: React.ReactNode }) {
  return (
    <button type="button" className={className} onClick={() => window.dispatchEvent(new CustomEvent(EVENTO, { detail: pestana }))}>
      {children}
    </button>
  );
}

const ROLES = [
  { rol: "arquitecto", titulo: "Arquitecto", texto: "Presupuesto, cronograma, costos y compras" },
  { rol: "cliente", titulo: "Cliente", texto: "Lo que ve el dueño de la obra" },
  { rol: "obrero", titulo: "Equipo de obra", texto: "La vista del capataz en el celular" },
] as const;

export function Presentacion({ demo }: { demo: boolean }) {
  const [abierta, setAbierta] = useState(false);
  const [tab, setTab] = useState<Pestana>("que");
  const video = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const abrir = (e: Event) => { setTab(((e as CustomEvent).detail as Pestana) ?? "que"); setAbierta(true); };
    window.addEventListener(EVENTO, abrir);
    // primera visita: se abre sola, una sola vez
    let t: ReturnType<typeof setTimeout> | undefined;
    try {
      if (!localStorage.getItem(VISTO)) t = setTimeout(() => { setAbierta(true); try { localStorage.setItem(VISTO, "1"); } catch {} }, 1200);
    } catch {}
    return () => { window.removeEventListener(EVENTO, abrir); if (t) clearTimeout(t); };
  }, []);

  useEffect(() => {
    if (!abierta) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setAbierta(false);
    document.addEventListener("keydown", esc);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", esc); document.body.style.overflow = ""; };
  }, [abierta]);

  useEffect(() => {
    if (tab === "video" && abierta) video.current?.play().catch(() => {});
    else video.current?.pause();
  }, [tab, abierta]);

  return (
    <>
      <button
        type="button"
        onClick={() => { setTab("que"); setAbierta(true); }}
        className="fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full bg-zinc-900 px-4 py-3 text-sm font-semibold text-white shadow-xl shadow-zinc-900/20 transition hover:-translate-y-0.5"
      >
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white text-xs text-zinc-900">?</span>
        ¿Qué es Obrapp?
      </button>

      {abierta && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-zinc-950/60 p-0 backdrop-blur-sm sm:items-center sm:p-6" onClick={() => setAbierta(false)} role="dialog" aria-modal="true" aria-label="Qué es Obrapp">
          <div className="relative flex max-h-[94vh] w-full max-w-4xl flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
            <button type="button" onClick={() => setAbierta(false)} className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-zinc-100 text-lg text-zinc-600 hover:bg-zinc-200" aria-label="Cerrar">×</button>

            <div className="border-b border-zinc-100 px-6 pt-6 sm:px-8">
              <div className="flex items-center gap-2 text-sm font-semibold text-brand-700">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-700 text-xs font-bold text-white">O</span>Obrapp
                <span className="ml-1 rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium">Para arquitectos y constructoras</span>
              </div>
              <div className="-mb-px mt-4 flex gap-1 overflow-x-auto">
                {([["que", "¿Qué es?"], ["como", "¿Cómo se usa?"], ["soluciona", "¿Qué te soluciona?"], ["video", "▶ Video 30 s"]] as const).map(([k, l]) => (
                  <button key={k} type="button" onClick={() => setTab(k)} className={`whitespace-nowrap border-b-2 px-3 py-2.5 text-[15px] font-medium ${tab === k ? "border-brand-700 text-brand-800" : "border-transparent text-zinc-500 hover:text-zinc-800"}`}>{l}</button>
                ))}
              </div>
            </div>

            <div className="overflow-y-auto px-6 py-6 sm:px-8">
              {tab === "que" && (
                <div className="grid items-center gap-8 md:grid-cols-2">
                  <div>
                    <h2 className="text-3xl font-extrabold leading-tight tracking-tight">Tu obra entera,<br /><span className="text-brand-700">en un solo lugar.</span></h2>
                    <p className="mt-4 text-[17px] leading-relaxed text-zinc-600">Obrapp es un sistema para dirigir obras. Cargás los datos básicos y te arma <b>las tareas, los materiales, el presupuesto y el cronograma</b>. Después, tu equipo informa desde el celular y tu cliente sigue el avance sin llamarte.</p>
                    <ul className="mt-5 space-y-2.5 text-[15px] text-zinc-700">
                      <li className="flex gap-2"><span className="text-brand-700">✓</span>Funciona en la compu y en el celular, sin instalar nada.</li>
                      <li className="flex gap-2"><span className="text-brand-700">✓</span>Cada uno ve lo suyo: el cliente nunca ve tus costos ni tu ganancia.</li>
                      <li className="flex gap-2"><span className="text-brand-700">✓</span>Pensado para obra argentina: plantillas, rubros y precios en pesos.</li>
                    </ul>
                  </div>
                  <button type="button" onClick={() => setTab("video")} className="group relative overflow-hidden rounded-2xl shadow-lg">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/landing/video-poster.jpg" alt="Video de presentación" className="block w-full transition group-hover:scale-[1.02]" />
                    <span className="absolute inset-0 flex items-center justify-center bg-black/10">
                      <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white/95 pl-1 text-2xl text-brand-800 shadow-xl">▶</span>
                    </span>
                    <span className="absolute bottom-3 left-3 rounded-full bg-black/60 px-2.5 py-1 text-xs font-medium text-white">Mirá cómo funciona · 30 s</span>
                  </button>
                </div>
              )}

              {tab === "como" && (
                <div>
                  <h2 className="text-2xl font-bold tracking-tight">Así se usa, en cuatro pasos</h2>
                  <ol className="mt-5 grid gap-4 sm:grid-cols-2">
                    {[
                      ["Cargás la obra", "Tipo de obra, sistema constructivo, m² y fecha de inicio. Son tres pantallas y dos minutos.", "🏗️"],
                      ["Obrapp la arma", "Genera los rubros y tareas, calcula los materiales, el presupuesto con honorarios e IVA y el cronograma. Vos solo cargás tus precios.", "⚡"],
                      ["Sumás a tu equipo y al cliente", "El capataz entra con su DNI y un PIN. El cliente, con su email. Cada uno ve solo lo que le corresponde.", "👷"],
                      ["La seguís día a día", "Te llegan los partes diarios, los avances con fotos y los pedidos de material. Aprobás con un toque y ves cómo va a terminar la obra.", "📈"],
                    ].map(([t, d, e], i) => (
                      <li key={t} className="flex gap-4 rounded-2xl bg-zinc-50 p-5">
                        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-2xl shadow-sm">{e}</span>
                        <span>
                          <span className="text-xs font-semibold uppercase tracking-wide text-brand-700">Paso {i + 1}</span>
                          <span className="mt-0.5 block text-lg font-semibold">{t}</span>
                          <span className="mt-1 block text-[15px] text-zinc-600">{d}</span>
                        </span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              {tab === "soluciona" && (
                <div>
                  <h2 className="text-2xl font-bold tracking-tight">Lo que deja de pasarte</h2>
                  <div className="mt-5 overflow-hidden rounded-2xl ring-1 ring-zinc-200">
                    <div className="grid grid-cols-2 bg-zinc-50 text-sm font-semibold">
                      <div className="px-4 py-2.5 text-red-700">Hoy</div>
                      <div className="border-l border-zinc-200 px-4 py-2.5 text-brand-700">Con Obrapp</div>
                    </div>
                    {[
                      ["Armás el presupuesto en un Excel que se rompe", "Se arma solo desde los m² y se actualiza al cambiar un precio"],
                      ["El pedido de material se pierde en el grupo de WhatsApp", "Cada pedido queda cargado, con prioridad, y lo aprobás con un toque"],
                      ["Te enterás del atraso cuando ya es tarde", "Ves qué está atrasado y qué necesita tu atención hoy"],
                      ["No sabés cuánto vas a terminar gastando", "Proyección del costo al cierre por rubro y gastos fuera de presupuesto"],
                      ["El cliente llama para preguntar cómo va", "El cliente ve el avance, las fotos y aprueba los cambios desde su portal"],
                      ["No sabés quién fue a la obra ni qué hizo", "Parte diario con personal, horas, clima, fotos y problemas"],
                    ].map(([a, b]) => (
                      <div key={a} className="grid grid-cols-2 border-t border-zinc-100 text-[15px]">
                        <div className="px-4 py-3 text-zinc-500"><span className="mr-1.5 text-red-500">✕</span>{a}</div>
                        <div className="border-l border-zinc-100 px-4 py-3 text-zinc-800"><span className="mr-1.5 text-brand-700">✓</span>{b}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {tab === "video" && (
                <video ref={video} src="/landing/obrapp-30s.mp4" poster="/landing/video-poster.jpg" controls playsInline className="w-full rounded-2xl bg-black" />
              )}
            </div>

            <div className="border-t border-zinc-100 bg-zinc-50 px-6 py-5 sm:px-8">
              {demo ? (
                <>
                  <div className="text-[15px] font-semibold">Probalo ahora, sin crear cuenta</div>
                  <p className="hidden text-sm text-zinc-500 sm:block">Entrás a una obra de ejemplo con datos ficticios. Elegí cómo querés verla:</p>
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    {ROLES.map((r) => (
                      <a key={r.rol} href={`/demo?rol=${r.rol}`} className="group rounded-xl bg-white px-3 py-2.5 text-sm ring-1 sm:px-4 sm:py-3 sm:text-base ring-zinc-200 transition hover:ring-brand-700">
                        <span className="flex items-center justify-between gap-1 font-semibold">{r.titulo}<span className="text-brand-700 transition group-hover:translate-x-0.5">→</span></span>
                        <span className="hidden text-sm text-zinc-500 sm:block">{r.texto}</span>
                      </a>
                    ))}
                  </div>
                  <p className="mt-3 text-sm text-zinc-500">¿Ya te convenció? <a href="/registro" className="font-medium text-brand-700 hover:underline">Creá tu cuenta gratis</a></p>
                </>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="text-[15px] text-zinc-600">Sin tarjeta · Sin instalar nada</span>
                  <a href="/registro" className="btn-primary px-5 py-2.5">Crear cuenta gratis</a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
