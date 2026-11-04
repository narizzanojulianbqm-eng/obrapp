import Link from "next/link";
import { and, eq, sql } from "drizzle-orm";
import { modoDemo } from "@/lib/entorno";
import { Shell, type NavSection } from "@/components/shell";
import { requireObra } from "@/lib/access";
import { noLeidas } from "@/lib/queries";
import { db, schema } from "@/lib/db";
import { ROL_LABEL } from "@/lib/format";

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
    sections = [
      { title: "Obra", links: [{ href: b, label: "Resumen", icon: "dashboard", exact: true }, { href: `${b}/datos`, label: "Datos de obra", icon: "datos" }, { href: `${b}/equipo`, label: "Equipo", icon: "equipo" }, { href: `${b}/historial`, label: "Historial", icon: "historial" }] },
      { title: "Planificación", links: [{ href: `${b}/rubros`, label: "Rubros y tareas", icon: "rubros" }, { href: `${b}/gantt`, label: "Diagrama de Gantt", icon: "gantt" }, { href: `${b}/seguimiento`, label: "Seguimiento", icon: "seguimiento" }] },
      { title: "Planillas", links: [{ href: `${b}/computo`, label: "Cómputo de materiales", icon: "computo" }, { href: `${b}/precios`, label: "Análisis de precios", icon: "precios" }, { href: `${b}/presupuesto`, label: "Presupuesto", icon: "presupuesto" }, { href: `${b}/costos`, label: "Costos y beneficios", icon: "costos" }] },
      { title: "Abastecimiento", links: [{ href: `${b}/solicitudes`, label: "Solicitudes", icon: "solicitudes", badge: Number(sol) }, { href: `${b}/compras`, label: "Compras", icon: "compras" }, { href: `${b}/cotizaciones`, label: "Cotizaciones", icon: "cotizaciones" }] },
      { title: "Comunicación", links: [{ href: `${b}/mensajes`, label: "Mensajes", icon: "mensajes" }, { href: `${b}/documentos`, label: "Documentación", icon: "docs" }, { href: `${b}/asistente`, label: "Asistente IA", icon: "ia" }, { href: "/whatsapp", label: "WhatsApp", icon: "whatsapp" }, { href: `${b}/reporte`, label: "Reporte", icon: "reportes" }] },
    ];
  } else if (rol === "cliente") {
    sections = [
      { links: [{ href: b, label: "Estado de la obra", icon: "dashboard", exact: true }, { href: `${b}/gantt`, label: "Cronograma", icon: "gantt" }, { href: `${b}/seguimiento`, label: "Avances y fotos", icon: "seguimiento" }] },
      { title: "Dinero", links: [{ href: `${b}/presupuesto`, label: "Presupuesto", icon: "presupuesto", badge: Number(adic) }, { href: `${b}/compras`, label: "Compras y gastos", icon: "compras", badge: Number(comp) }] },
      { title: "Comunicación", links: [{ href: `${b}/mensajes`, label: "Mensajes", icon: "mensajes" }, { href: `${b}/documentos`, label: "Documentación", icon: "docs" }, { href: `${b}/asistente`, label: "Asistente IA", icon: "ia" }, { href: `${b}/reporte`, label: "Reporte", icon: "reportes" }] },
    ];
  } else {
    sections = [
      { links: [{ href: b, label: "Inicio", icon: "dashboard", exact: true }, { href: `${b}/seguimiento`, label: "Mis tareas", icon: "seguimiento" }, { href: `${b}/gantt`, label: "Cronograma", icon: "gantt" }] },
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
