import Link from "next/link";
import { and, eq, sql } from "drizzle-orm";
import { modoDemo } from "@/lib/entorno";
import { Shell, type NavSection } from "@/components/shell";
import { requireObra } from "@/lib/access";
import { noLeidas } from "@/lib/queries";
import { db, schema } from "@/lib/db";
import { ROL_LABEL } from "@/lib/format";
import { clienteVe } from "@/lib/portal";

export default async function ObraLayout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, obra, rol } = await requireObra(id);
  const b = `/obras/${id}`;
  const [unread, [{ sol }], [{ adic }], [{ comp }]] = await Promise.all([
    noLeidas(user.id),
    db.select({ sol: sql<number>`count(*)` }).from(schema.solicitudes).where(and(eq(schema.solicitudes.obraId, id), eq(schema.solicitudes.estado, "pendiente"))),
    db.select({ adic: sql<number>`count(*)` }).from(schema.adicionales).where(and(eq(schema.adicionales.obraId, id), eq(schema.adicionales.estado, "pendiente"))),
    db.select({ comp: sql<number>`count(*)` }).from(schema.compras).where(and(eq(schema.compras.obraId, id), eq(schema.compras.aprobacionCliente, "pendiente"))),
  ]);

  let sections: NavSection[];
  if (rol === "arquitecto") {
    // 6 secciones; el detalle va en pestañas dentro de cada una
    sections = [
      {
        links: [
          { href: b, label: "Inicio", icon: "dashboard", exact: true },
          { href: `${b}/gantt`, label: "Planificación", icon: "gantt", tabs: [{ href: `${b}/gantt`, label: "Cronograma" }, { href: `${b}/rubros`, label: "Tareas" }, { href: `${b}/seguimiento`, label: "Avance" }, { href: `${b}/partes`, label: "Partes diarios" }], match: [`${b}/tarea`] },
          { href: `${b}/presupuesto`, label: "Presupuesto", icon: "presupuesto", tabs: [{ href: `${b}/presupuesto`, label: "Presupuesto" }, { href: `${b}/precios`, label: "Precios" }, { href: `${b}/computo`, label: "Materiales" }, { href: `${b}/costos`, label: "Costos y ganancia" }] },
          { href: `${b}/solicitudes`, label: "Compras", icon: "compras", badge: Number(sol), tabs: [{ href: `${b}/solicitudes`, label: "Pedidos de obra", badge: Number(sol) }, { href: `${b}/compras`, label: "Compras" }, { href: `${b}/cotizaciones`, label: "Cotizaciones" }] },
          { href: `${b}/mensajes`, label: "Comunicación", icon: "mensajes", tabs: [{ href: `${b}/mensajes`, label: "Mensajes" }, { href: `${b}/documentos`, label: "Documentos" }, { href: `${b}/asistente`, label: "Asistente" }] },
          { href: `${b}/datos`, label: "Ajustes de obra", icon: "datos", tabs: [{ href: `${b}/datos`, label: "Datos" }, { href: `${b}/equipo`, label: "Equipo" }, { href: `${b}/reporte`, label: "Reportes" }, { href: `${b}/historial`, label: "Historial" }] },
        ],
      },
    ];
  } else if (rol === "cliente") {
    const ve = (c: Parameters<typeof clienteVe>[1]) => clienteVe(obra, c);
    const quitarVacias = (xs: NavSection[]) => xs.filter((x) => x.links.length);
    sections = quitarVacias([
      { links: [{ href: b, label: "Estado de la obra", icon: "dashboard" as const, exact: true }, ...(ve("cronograma") ? [{ href: `${b}/gantt`, label: "Cronograma", icon: "gantt" as const }] : []), ...(ve("avances") ? [{ href: `${b}/seguimiento`, label: "Avances y fotos", icon: "seguimiento" as const }] : [])] },
      { title: "Dinero", links: [...(ve("presupuesto") ? [{ href: `${b}/presupuesto`, label: "Presupuesto", icon: "presupuesto" as const, badge: Number(adic) }] : []), ...(ve("compras") ? [{ href: `${b}/compras`, label: "Compras y gastos", icon: "compras" as const, badge: Number(comp) }] : [])] },
      { title: "Comunicación", links: [...(ve("mensajes") ? [{ href: `${b}/mensajes`, label: "Mensajes", icon: "mensajes" as const }] : []), ...(ve("documentos") ? [{ href: `${b}/documentos`, label: "Documentación", icon: "docs" as const }] : []), ...(ve("asistente") ? [{ href: `${b}/asistente`, label: "Asistente IA", icon: "ia" as const }] : []), { href: `${b}/reporte`, label: "Reporte", icon: "reportes" as const }] },
    ]);
  } else {
    sections = [
      { links: [{ href: b, label: "Inicio", icon: "dashboard", exact: true }, { href: `${b}/partes`, label: "Parte del día", icon: "parte" }, { href: `${b}/seguimiento`, label: "Mis tareas", icon: "seguimiento" }, { href: `${b}/gantt`, label: "Cronograma", icon: "gantt" }] },
      { title: "Materiales", links: [{ href: `${b}/computo`, label: "Materiales de la obra", icon: "computo" }, { href: `${b}/solicitudes`, label: "Pedir materiales", icon: "solicitudes" }] },
      { title: "Comunicación", links: [{ href: `${b}/mensajes`, label: "Mensajes", icon: "mensajes" }, { href: `${b}/documentos`, label: "Planos y documentos", icon: "docs" }, { href: `${b}/asistente`, label: "Asistente IA", icon: "ia" }] },
    ];
  }

  const header = (
    <div className="border-b border-zinc-200 px-4 py-3">
      <Link href="/obras" className="text-xs text-zinc-500 hover:text-zinc-800">← Todas las obras</Link>
      <div className="mt-1 truncate font-medium leading-tight">{obra.nombre}</div>
      <div className="mt-0.5 flex items-center gap-2 text-xs text-zinc-500">
        <span>{obra.codigo}</span>·<span>{ROL_LABEL[rol]}</span>
      </div>
    </div>
  );
  return (
    <Shell demo={modoDemo()} sections={sections} userName={user.nombre} unread={unread} header={header}>
      {children}
    </Shell>
  );
}
