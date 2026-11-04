"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import {
  LayoutDashboard, Building2, PlusCircle, Truck, Settings, Bell, Menu, X, ListTree, Calculator, Receipt, Wallet, GanttChart,
  Package, ClipboardList, ShoppingCart, FileText, MessagesSquare, BarChart3, Sparkles, Users, Info, Activity, ArrowLeft, Scale, LogOut, Tags, MessageCircle, History, NotebookPen,
} from "lucide-react";

const ICONOS = {
  dashboard: LayoutDashboard, obras: Building2, nueva: PlusCircle, proveedores: Truck, config: Settings, rubros: ListTree, computo: Package,
  precios: Calculator, presupuesto: Receipt, costos: Wallet, gantt: GanttChart, solicitudes: ClipboardList, compras: ShoppingCart, docs: FileText,
  mensajes: MessagesSquare, reportes: BarChart3, ia: Sparkles, equipo: Users, datos: Info, seguimiento: Activity, atras: ArrowLeft, cotizaciones: Scale, insumos: Tags, whatsapp: MessageCircle, historial: History, parte: NotebookPen,
} as const;
export type IconName = keyof typeof ICONOS;
export type NavTab = { href: string; label: string; badge?: number; exact?: boolean };
export type NavLink = { href: string; label: string; icon: IconName; badge?: number; exact?: boolean; tabs?: NavTab[]; match?: string[] };
export type NavSection = { title?: string; links: NavLink[] };

export function Shell({
  sections,
  userName,
  unread,
  header,
  children,
  demo,
}: {
  sections: NavSection[];
  userName: string;
  unread: number;
  header?: ReactNode;
  children: ReactNode;
  demo?: boolean;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const activo1 = (href: string, exact?: boolean) => (exact ? pathname === href : pathname === href || pathname.startsWith(href + "/"));
  // un ítem del menú está activo si lo está él o cualquiera de sus pestañas
  const linkActivo = (l: NavLink) => activo1(l.href, l.exact) || (l.tabs ?? []).some((t) => activo1(t.href, t.exact)) || (l.match ?? []).some((m) => activo1(m));
  const actual = sections.flatMap((x) => x.links).find((l) => l.tabs?.length && linkActivo(l));

  const nav = (
    <nav className="flex h-full flex-col">
      <div className="flex h-14 items-center gap-2 border-b border-zinc-200 px-4">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-brand-700 text-xs font-bold text-white">O</div>
        <span className="font-semibold tracking-tight">Obrapp</span>
      </div>
      {header}
      <div className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
        {sections.map((s, i) => (
          <div key={i}>
            {s.title && <div className="mb-1.5 px-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">{s.title}</div>}
            <ul className="space-y-0.5">
              {s.links.map((l) => {
                const Icon = ICONOS[l.icon];
                const on = linkActivo(l);
                return (
                  <li key={l.href}>
                    <Link
                      href={l.href}
                      onClick={() => setOpen(false)}
                      className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] ${on ? "bg-zinc-900 text-white" : "text-zinc-700 hover:bg-zinc-100"}`}
                    >
                      <Icon className="h-5 w-5 shrink-0" strokeWidth={1.75} />
                      <span className="flex-1 truncate">{l.label}</span>
                      {!!l.badge && <span className={`rounded-full px-1.5 text-[11px] font-medium ${on ? "bg-white/20" : "bg-amber-100 text-amber-800"}`}>{l.badge}</span>}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-zinc-200 p-3">
        <div className="flex items-center gap-2 px-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-200 text-xs font-semibold text-zinc-700">
            {userName.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase()}
          </div>
          <div className="min-w-0 flex-1 truncate text-sm">{userName}</div>
          <form action="/api/auth/logout" method="post">
            <button className="rounded p-1.5 text-zinc-500 hover:bg-zinc-100" title="Cerrar sesión">
              <LogOut className="h-4 w-4" />
            </button>
          </form>
        </div>
      </div>
    </nav>
  );

  return (
    <div className="min-h-screen">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-zinc-200 bg-white lg:block">{nav}</aside>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-zinc-900/30" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 bg-white shadow-xl">{nav}</aside>
        </div>
      )}
      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-zinc-200 bg-white/90 px-4 backdrop-blur lg:px-8">
          <button className="rounded-md p-1.5 text-zinc-600 hover:bg-zinc-100 lg:hidden" onClick={() => setOpen(!open)} aria-label="Menú">
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <div className="flex-1">
            {demo && <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800">Entorno de prueba · datos ficticios</span>}
          </div>
          <Link href="/notificaciones" className="relative rounded-md p-1.5 text-zinc-600 hover:bg-zinc-100" aria-label="Notificaciones">
            <Bell className="h-5 w-5" strokeWidth={1.75} />
            {unread > 0 && <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-semibold text-white">{unread}</span>}
          </Link>
        </header>
        <main className="mx-auto max-w-7xl px-4 py-6 lg:px-8 lg:py-8">
          {actual?.tabs && (
            <div className="-mt-1 mb-6 flex gap-1 overflow-x-auto border-b border-zinc-200">
              {actual.tabs.map((t) => {
                const on = activo1(t.href, t.exact) && !actual.tabs!.some((o) => o !== t && o.href.length > t.href.length && activo1(o.href, o.exact));
                return (
                  <Link key={t.href} href={t.href} className={`-mb-px flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-[15px] ${on ? "border-brand-700 font-medium text-zinc-900" : "border-transparent text-zinc-500 hover:text-zinc-800"}`}>
                    {t.label}
                    {!!t.badge && <span className="rounded-full bg-amber-100 px-1.5 text-xs font-medium text-amber-800">{t.badge}</span>}
                  </Link>
                );
              })}
            </div>
          )}
          {children}
        </main>
      </div>
    </div>
  );
}
