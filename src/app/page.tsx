import Link from "next/link";
import type { Metadata } from "next";
import { PLANES } from "@/lib/planes";
import { precioPlan } from "@/lib/pagos";
import { waActivo } from "@/lib/whatsapp/config";
import { modoDemo } from "@/lib/entorno";
import { getUser } from "@/lib/auth";
import { AbrirPresentacion, Presentacion } from "@/components/landing/presentacion";

export const metadata: Metadata = {
  title: "Obrapp — Cargás los m², Obrapp arma la obra",
  description: "Software de gestión de obras para arquitectos y constructoras: rubros, cómputo, presupuesto y cronograma automáticos; equipo y cliente conectados.",
};

const ars = (n: number) => n.toLocaleString("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });

function Ventana({ src, alt, className = "" }: { src: string; alt: string; className?: string }) {
  return (
    <div className={`overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl shadow-zinc-900/10 ${className}`}>
      <div className="flex h-8 items-center gap-1.5 border-b border-zinc-100 bg-zinc-50 px-3">
        <i className="h-2.5 w-2.5 rounded-full bg-zinc-300" /><i className="h-2.5 w-2.5 rounded-full bg-zinc-300" /><i className="h-2.5 w-2.5 rounded-full bg-zinc-300" />
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} className="block w-full" />
    </div>
  );
}

function PanelAtencion() {
  const filas = [
    { c: "bg-red-500", t: "Albañilería viene 14 % arriba del presupuesto", d: "Terminaría en $ 12.840.000", v: "+14%", vc: "text-red-600" },
    { c: "bg-amber-500", t: "Pedido de material: 4 m³ de arena", d: "Carlos · para mañana", v: "Aprobar", vc: "text-brand-700" },
    { c: "bg-amber-500", t: "Parte de hoy: se suspendió la tarde por lluvia", d: "2 personas · 4 h", v: "Ver", vc: "text-brand-700" },
    { c: "bg-zinc-300", t: "El cliente aprobó el adicional del quincho", d: "+ $ 1.950.000", v: "✓", vc: "text-brand-700" },
  ];
  return (
    <div className="relative">
      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl shadow-zinc-900/10">
        <div className="flex h-9 items-center gap-1.5 border-b border-zinc-100 bg-zinc-50 px-3">
          <i className="h-2.5 w-2.5 rounded-full bg-zinc-300" /><i className="h-2.5 w-2.5 rounded-full bg-zinc-300" /><i className="h-2.5 w-2.5 rounded-full bg-zinc-300" />
          <span className="ml-3 rounded-md bg-white px-2 py-0.5 text-xs text-zinc-400 ring-1 ring-zinc-200">obrapp · Vivienda Familia Pérez</span>
        </div>
        <div className="grid grid-cols-3 gap-3 p-4">
          {[["Avance", "38 %", "En tiempo", "text-brand-700"], ["Termina", "17 mar", "2027", "text-zinc-500"], ["Gastado", "$ 41,2 M", "de $ 113,6 M", "text-zinc-500"]].map(([l, v, h, hc]) => (
            <div key={l} className="rounded-xl bg-zinc-50 p-3">
              <div className="text-xs text-zinc-500">{l}</div>
              <div className="mt-0.5 text-xl font-bold tabular-nums">{v}</div>
              <div className={`text-xs ${hc}`}>{h}</div>
            </div>
          ))}
        </div>
        <div className="px-4 pb-4">
          <div className="mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-zinc-500">Necesita tu atención <span className="rounded-full bg-red-50 px-2 py-0.5 text-red-600">3</span></div>
          <div className="space-y-1.5">
            {filas.map((f) => (
              <div key={f.t} className="flex items-center gap-3 rounded-xl px-3 py-2.5 ring-1 ring-zinc-100">
                <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${f.c}`} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{f.t}</span>
                  <span className="block text-xs text-zinc-500">{f.d}</span>
                </span>
                <span className={`text-sm font-semibold ${f.vc}`}>{f.v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="absolute -bottom-24 -left-6 hidden w-56 rounded-2xl bg-white p-4 shadow-2xl ring-1 ring-zinc-200 sm:block">
        <div className="flex items-center gap-2 text-xs text-zinc-500"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-50 text-sm">👷</span>Carlos · capataz</div>
        <div className="mt-2 text-sm font-semibold">Parte del día</div>
        <div className="mt-1 text-xs text-zinc-600">4 personas · 8 h · ☀️ Bueno</div>
        <div className="mt-1 text-xs text-zinc-600">Terminamos la mampostería del frente 📷</div>
        <div className="mt-3 rounded-lg bg-brand-700 py-1.5 text-center text-xs font-semibold text-white">Enviado ✓</div>
      </div>
    </div>
  );
}

export default async function Landing() {
  const wa = waActivo();
  const demo = modoDemo();
  const usuario = await getUser().catch(() => null);
  const precio = (p: "profesional" | "estudio") => precioPlan(p);
  return (
    <div className="bg-white text-zinc-900">
      <Presentacion demo={demo} />
      {/* Navegación */}
      <header className="sticky top-0 z-30 border-b border-zinc-100 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-5">
          <Link href="/" className="flex items-center gap-2 font-semibold"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-700 text-sm font-bold text-white">O</span>Obrapp</Link>
          <nav className="hidden gap-6 text-[15px] text-zinc-600 md:flex">
            <AbrirPresentacion className="hover:text-zinc-900">Qué es</AbrirPresentacion>
            <a href="#como" className="hover:text-zinc-900">Cómo funciona</a>
            <a href="#funciones" className="hover:text-zinc-900">Funciones</a>
            {demo && <a href="#probar" className="hover:text-zinc-900">Ver demo</a>}
            <a href="#planes" className="hover:text-zinc-900">Planes</a>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            {usuario ? (
              <Link href="/dashboard" className="btn-primary">Ir a mis obras →</Link>
            ) : (
              <>
                <Link href="/login" className="btn-ghost">Ingresar</Link>
                <Link href="/registro" className="btn-primary">Probar gratis</Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-b from-brand-50 to-white">
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(37,79,66,0.06)_1px,transparent_1px),linear-gradient(to_bottom,rgba(37,79,66,0.06)_1px,transparent_1px)] bg-[size:48px_48px] [mask-image:linear-gradient(to_bottom,black,transparent)]" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-14 px-5 pb-28 pt-14 lg:grid-cols-2 lg:pt-20">
          <div>
            <span className="inline-block rounded-full bg-white px-3 py-1 text-sm font-medium text-brand-700 ring-1 ring-brand-100">Para estudios de arquitectura y constructoras</span>
            <h1 className="mt-5 text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-6xl">Cargás los m².<br /><span className="text-brand-700">Obrapp arma la obra.</span></h1>
            <p className="mt-6 max-w-xl text-lg text-zinc-600">Rubros, materiales, presupuesto y cronograma se generan solos. Tu equipo informa desde el celular, tu cliente sigue el avance sin llamarte y vos sabés cómo va a terminar la obra.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              {demo ? (
                <a href="/demo?rol=arquitecto" className="btn-primary px-6 py-3 text-base">Ver la demo sin cuenta →</a>
              ) : (
                <Link href="/registro" className="btn-primary px-6 py-3 text-base">Empezar gratis</Link>
              )}
              <AbrirPresentacion pestana="video" className="btn-secondary gap-2 px-6 py-3 text-base"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-700 pl-0.5 text-[10px] text-white">▶</span>Cómo funciona (30 s)</AbrirPresentacion>
            </div>
            <p className="mt-4 text-sm text-zinc-500">{demo ? "Entrás a una obra de ejemplo con un clic · " : ""}Sin tarjeta · Sin instalar nada · Compu y celular</p>
          </div>
          <PanelAtencion />
        </div>
      </section>

      {/* Números */}
      <section className="border-y border-zinc-100 bg-white">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-6 px-5 py-10 md:grid-cols-4">
          {[["2 min", "para cargar una obra nueva"], ["15 rubros", "y 37 tareas generadas solas en una vivienda"], ["3 perfiles", "arquitecto, cliente y equipo de obra"], ["0", "planillas paralelas que mantener"]].map(([n, t]) => (
            <div key={n}>
              <div className="text-3xl font-extrabold tracking-tight text-brand-700">{n}</div>
              <div className="mt-1 text-[15px] text-zinc-600">{t}</div>
            </div>
          ))}
        </div>
      </section>

      {/* El problema */}
      <section className="mx-auto max-w-6xl px-5 py-20">
        <h2 className="max-w-3xl text-3xl font-bold tracking-tight sm:text-4xl">Si tu obra hoy vive en el grupo de WhatsApp, en tres Excel y en tu cabeza, no estás solo.</h2>
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {[
            ["47 mensajes sin leer", "Pedidos de material, fotos, preguntas del cliente y avisos del corralón, todo mezclado en el mismo grupo."],
            ["presupuesto_FINAL_v7.xlsx", "Fórmulas rotas, precios de hace tres meses y nadie sabe cuál es la versión buena."],
            ["“¿Cuánto me sale el cambio?”", "El cliente llama en el peor momento y la respuesta depende de rehacer medio presupuesto."],
          ].map(([t, d]) => (
            <div key={t} className="rounded-2xl border border-zinc-200 p-6">
              <div className="text-lg font-semibold text-red-700">{t}</div>
              <p className="mt-2 text-zinc-600">{d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Cómo funciona */}
      <section id="como" className="bg-zinc-50 py-20">
        <div className="mx-auto max-w-6xl px-5">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Cómo funciona</h2>
            <AbrirPresentacion pestana="como" className="text-[15px] font-semibold text-brand-700 hover:underline">Ver la explicación paso a paso →</AbrirPresentacion>
          </div>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {[
              ["1", "Cargás la obra", "Tipo, sistema constructivo, superficie y fecha de inicio. Tres pasos, dos minutos."],
              ["2", "Se arma sola", "Rubros y tareas, cantidades de materiales, análisis de precios, presupuesto con honorarios y cronograma. Vos cargás tus precios."],
              ["3", "La seguís en vivo", "El equipo informa avances y pide materiales desde el celular. Vos aprobás, controlás costos y el cliente ve lo que corresponde."],
            ].map(([n, t, d]) => (
              <div key={n} className="rounded-2xl bg-white p-7 shadow-sm ring-1 ring-zinc-200">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-700 font-bold text-white">{n}</div>
                <div className="mt-4 text-xl font-semibold">{t}</div>
                <p className="mt-2 text-zinc-600">{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Funciones con capturas */}
      <section id="funciones" className="mx-auto max-w-6xl space-y-24 px-5 py-24">
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <div>
            <div className="text-sm font-semibold uppercase tracking-wide text-brand-700">Presupuesto automático</div>
            <h3 className="mt-2 text-3xl font-bold tracking-tight">De los m² al presupuesto completo, sin fórmulas rotas.</h3>
            <ul className="mt-5 space-y-2 text-lg text-zinc-600">
              <li>✓ Plantillas de obra argentinas: tradicional, steel frame y refacción.</li>
              <li>✓ Cómputo de materiales y análisis de precios por ítem.</li>
              <li>✓ Gastos generales, beneficio, honorarios e IVA, con incidencia por rubro.</li>
              <li>✓ Importás tu Excel actual y exportás a Excel o PDF.</li>
            </ul>
          </div>
          <Ventana src="/landing/presupuesto.jpg" alt="Presupuesto general" />
        </div>
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <Ventana src="/landing/gantt.jpg" alt="Cronograma de la obra" className="lg:order-1" />
          <div className="lg:order-2">
            <div className="text-sm font-semibold uppercase tracking-wide text-brand-700">Cronograma que se recalcula</div>
            <h3 className="mt-2 text-3xl font-bold tracking-tight">Llovió tres días: movés una tarea y todo se reacomoda.</h3>
            <p className="mt-5 text-lg text-zinc-600">Las duraciones salen de los rendimientos de cada tarea y las dependencias se respetan solas. Ves de un vistazo qué está terminado, qué está en curso y qué está atrasado.</p>
          </div>
        </div>
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <div>
            <div className="text-sm font-semibold uppercase tracking-wide text-brand-700">
              Equipo y cliente conectados {!wa && <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs normal-case text-amber-800">WhatsApp: próximamente</span>}
            </div>
            <h3 className="mt-2 text-3xl font-bold tracking-tight">El capataz escribe “faltan 20 bolsas de cemento” y el pedido se carga solo.</h3>
            <ul className="mt-5 space-y-2 text-lg text-zinc-600">
              <li>✓ El equipo entra con DNI y PIN, sin email, y carga el parte del día: personal, horas, clima y fotos.</li>
              <li>✓ Pedidos de material que aprobás con un toque y cotizaciones comparadas entre corralones.</li>
              <li>✓ El cliente pide un cambio y ve el costo y el plazo antes de aprobarlo.</li>
              <li>✓ Vos elegís qué ve el cliente. Nunca ve tus costos ni tus márgenes.</li>
              <li>✓ Sabés cómo termina la obra: proyección del costo al cierre por rubro y gastos fuera de presupuesto.</li>
            </ul>
          </div>
          <div className="mx-auto w-full max-w-sm rounded-[40px] border-[10px] border-zinc-900 bg-[#efeae2] p-4 shadow-2xl">
            <div className="-mx-4 -mt-4 mb-4 rounded-t-[30px] bg-[#008069] px-5 py-4 font-semibold text-white">Obrapp · asistente de obra</div>
            <div className="space-y-3 text-[15px]">
              <div className="ml-auto max-w-[85%] rounded-xl rounded-tr-sm bg-[#d9fdd3] px-3 py-2">Faltan 20 bolsas de cemento para mañana</div>
              <div className="max-w-[85%] rounded-xl rounded-tl-sm bg-white px-3 py-2">📦 Listo, cargué el pedido. Ya le avisé a la arquitecta.</div>
              <div className="ml-auto max-w-[85%] rounded-xl rounded-tr-sm bg-[#d9fdd3] px-3 py-2">Terminamos la mampostería del frente 📷</div>
              <div className="max-w-[85%] rounded-xl rounded-tl-sm bg-white px-3 py-2">✅ Registré el avance con la foto. ¿La marco como terminada?</div>
            </div>
          </div>
        </div>
      </section>

      {/* Probar sin cuenta */}
      {demo && (
        <section id="probar" className="bg-zinc-50 py-20">
          <div className="mx-auto max-w-6xl px-5">
            <div className="text-sm font-semibold uppercase tracking-wide text-brand-700">Sin registrarte</div>
            <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Mirala por dentro antes de crear tu cuenta</h2>
            <p className="mt-3 max-w-2xl text-lg text-zinc-600">Entrás con un clic a una obra de ejemplo, con datos ficticios. Podés tocar todo: no rompés nada.</p>
            <div className="mt-10 grid gap-5 md:grid-cols-3">
              {[
                { rol: "arquitecto", e: "📐", t: "Como arquitecto", d: "El panel completo: qué necesita tu atención, presupuesto, cronograma, compras, costos y cómo termina la obra.", cta: "Entrar como arquitecto" },
                { rol: "cliente", e: "🏠", t: "Como cliente", d: "Lo que ve el dueño: avance con fotos, presupuesto final, adicionales para aprobar. Sin tus costos ni tu ganancia.", cta: "Entrar como cliente" },
                { rol: "obrero", e: "👷", t: "Como capataz", d: "La vista del celular: parte del día, avances, pedir materiales y avisar problemas con botones grandes.", cta: "Entrar como capataz" },
              ].map((r) => (
                <a key={r.rol} href={`/demo?rol=${r.rol}`} className="group flex flex-col rounded-2xl bg-white p-7 ring-1 ring-zinc-200 transition hover:-translate-y-0.5 hover:shadow-xl hover:ring-brand-700">
                  <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 text-2xl">{r.e}</span>
                  <span className="mt-4 text-xl font-semibold">{r.t}</span>
                  <span className="mt-2 flex-1 text-zinc-600">{r.d}</span>
                  <span className="mt-5 font-semibold text-brand-700">{r.cta} <span className="inline-block transition group-hover:translate-x-1">→</span></span>
                </a>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Para quién */}
      <section id="para-quien" className="bg-brand-900 py-20 text-white">
        <div className="mx-auto max-w-6xl px-5">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Hecho para quienes construyen</h2>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {[
              ["Estudios de arquitectura", "Presupuestos en minutos, dirección de obra ordenada y clientes informados sin llamadas."],
              ["Constructoras", "Varias obras en paralelo, compras comparadas y costos reales contra lo presupuestado."],
              ["Directores de obra", "El equipo reporta desde el celular; vos ves atrasos, pedidos y problemas al instante."],
            ].map(([t, d]) => (
              <div key={t} className="rounded-2xl bg-white/5 p-7 ring-1 ring-white/10">
                <div className="text-xl font-semibold">{t}</div>
                <p className="mt-2 text-white/75">{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Planes */}
      <section id="planes" className="mx-auto max-w-6xl px-5 py-24">
        <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Planes según cuántas obras llevás</h2>
        <p className="mt-3 text-lg text-zinc-600">Todos los planes tienen todas las funciones. Las obras terminadas no ocupan lugar.</p>
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {(["gratuito", "profesional", "estudio"] as const).map((k) => {
            const p = PLANES[k];
            const valor = k === "gratuito" ? "Gratis" : precio(k) ? `${ars(precio(k)!)} / mes` : "Consultar";
            return (
              <div key={k} className={`rounded-2xl p-7 ring-1 ${k === "profesional" ? "bg-brand-50 ring-brand-500" : "ring-zinc-200"}`}>
                {k === "profesional" && <div className="mb-2 text-sm font-semibold text-brand-700">El más elegido</div>}
                <div className="text-xl font-semibold">{p.nombre}</div>
                <div className="mt-2 text-3xl font-bold">{valor}</div>
                <ul className="mt-5 space-y-2 text-zinc-600">
                  <li>✓ {p.obrasActivas === 1 ? "1 obra activa" : `Hasta ${p.obrasActivas} obras activas`}</li>
                  <li>✓ Hasta {p.miembrosPorObra} personas por obra</li>
                  <li>✓ {p.consultasIA} consultas al asistente por mes</li>
                  <li>✓ Presupuesto, cronograma, compras y cliente</li>
                </ul>
                <Link href="/registro" className={`mt-7 w-full ${k === "profesional" ? "btn-primary" : "btn-secondary"}`}>Empezar</Link>
              </div>
            );
          })}
        </div>
      </section>

      {/* Preguntas */}
      <section className="bg-zinc-50 py-20">
        <div className="mx-auto max-w-3xl px-5">
          <h2 className="text-3xl font-bold tracking-tight">Preguntas frecuentes</h2>
          <div className="mt-8 space-y-3">
            {[
              ["¿Tengo que instalar algo?", "No. Funciona desde el navegador en la computadora y en el celular. También se puede agregar a la pantalla de inicio del teléfono como una app."],
              ["¿Mis obreros necesitan email o saber usar un sistema?", "No. Entran con su DNI y un PIN de 6 números, desde el celular. Ven botones grandes para cargar el parte del día, informar avances, pedir materiales y avisar problemas."],
              ["¿Mi cliente puede ver mis costos?", "No. El cliente ve el avance, el cronograma, el presupuesto a precio final y lo que tiene que aprobar. Nunca ve costos internos, proveedores ni honorarios."],
              ["¿Obrapp trae precios de materiales?", "No inventamos precios: los cargás vos una vez, los copiás de otra obra o los actualizás con las cotizaciones de tus proveedores."],
              ["¿Mis datos están seguros?", "Sí. La información viaja cifrada, cada persona ve solo lo que le corresponde según su perfil y podés exportar todo cuando quieras."],
            ].map(([q, a]) => (
              <details key={q} className="group rounded-2xl bg-white p-5 ring-1 ring-zinc-200">
                <summary className="cursor-pointer list-none text-lg font-semibold">{q}<span className="float-right text-zinc-400 group-open:rotate-45">+</span></summary>
                <p className="mt-3 text-zinc-600">{a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Cierre */}
      <section className="mx-auto max-w-6xl px-5 py-24 text-center">
        <h2 className="text-4xl font-extrabold tracking-tight sm:text-5xl">Menos caos. <span className="text-brand-700">Más obra.</span></h2>
        <p className="mt-4 text-lg text-zinc-600">Creá tu primera obra en dos minutos.</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/registro" className="btn-primary px-8 py-3.5 text-lg">Probar gratis</Link>
          {demo && <a href="/demo?rol=arquitecto" className="btn-secondary px-8 py-3.5 text-lg">Ver la demo</a>}
        </div>
      </section>

      <footer className="border-t border-zinc-100 py-8 text-center text-sm text-zinc-500">© {new Date().getFullYear()} Obrapp · Gestión de obras hecha en Argentina</footer>
    </div>
  );
}
