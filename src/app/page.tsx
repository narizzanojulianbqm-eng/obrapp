import Link from "next/link";
import type { Metadata } from "next";
import { PLANES } from "@/lib/planes";
import { precioPlan } from "@/lib/pagos";
import { waActivo } from "@/lib/whatsapp/config";
import { modoDemo } from "@/lib/entorno";

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

export default function Landing() {
  const wa = waActivo();
  const demo = modoDemo();
  const precio = (p: "profesional" | "estudio") => precioPlan(p);
  return (
    <div className="bg-white text-zinc-900">
      {/* Navegación */}
      <header className="sticky top-0 z-30 border-b border-zinc-100 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-5">
          <Link href="/" className="flex items-center gap-2 font-semibold"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-700 text-sm font-bold text-white">O</span>Obrapp</Link>
          <nav className="hidden gap-6 text-[15px] text-zinc-600 md:flex">
            <a href="#como" className="hover:text-zinc-900">Cómo funciona</a>
            <a href="#funciones" className="hover:text-zinc-900">Funciones</a>
            <a href="#para-quien" className="hover:text-zinc-900">Para quién</a>
            <a href="#planes" className="hover:text-zinc-900">Planes</a>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <Link href="/login" className="btn-ghost">Ingresar</Link>
            <Link href="/registro" className="btn-primary">Probar gratis</Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-b from-brand-50 to-white">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 pb-16 pt-14 lg:grid-cols-2 lg:pt-20">
          <div>
            <span className="inline-block rounded-full bg-white px-3 py-1 text-sm font-medium text-brand-700 ring-1 ring-brand-100">Para estudios de arquitectura y constructoras</span>
            <h1 className="mt-5 text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-6xl">Cargás los m².<br /><span className="text-brand-700">Obrapp arma la obra.</span></h1>
            <p className="mt-6 max-w-xl text-lg text-zinc-600">Rubros, cómputo de materiales, presupuesto y cronograma se generan solos a partir de los datos de la obra. Tu equipo informa avances desde el celular y tu cliente sigue todo sin llamarte.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/registro" className="btn-primary px-6 py-3 text-base">Empezar gratis</Link>
              {demo && <Link href="/login" className="btn-secondary px-6 py-3 text-base">Ver la demo con datos de ejemplo</Link>}
            </div>
            <p className="mt-4 text-sm text-zinc-500">Sin tarjeta · Sin instalar nada · Funciona en computadora y celular</p>
          </div>
          <div className="relative">
            <Ventana src="/landing/inicio.jpg" alt="Inicio de una obra en Obrapp" />
            <div className="absolute -bottom-10 -left-6 hidden w-40 overflow-hidden rounded-[28px] border-[6px] border-zinc-900 shadow-2xl sm:block">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/landing/obrero-movil.jpg" alt="Vista del obrero en el celular" className="block w-full" />
            </div>
          </div>
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
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Cómo funciona</h2>
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
        <Link href="/registro" className="btn-primary mt-8 px-8 py-3.5 text-lg">Probar gratis</Link>
      </section>

      <footer className="border-t border-zinc-100 py-8 text-center text-sm text-zinc-500">© {new Date().getFullYear()} Obrapp · Gestión de obras hecha en Argentina</footer>
    </div>
  );
}
