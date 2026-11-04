import { and, desc, eq, inArray, like } from "drizzle-orm";
import { requireObra } from "@/lib/access";
import { db, schema } from "@/lib/db";
import { PageHeader, Section } from "@/components/ui";
import { fechaHora } from "@/lib/format";

const GRUPOS: Record<string, string> = {
  "": "Todo", obra: "Obra y datos", item: "Tareas", gantt: "Cronograma", precio: "Precios", presupuesto: "Presupuesto", solicitud: "Solicitudes",
  compra: "Compras", cotizacion: "Cotizaciones", pedido: "Pedidos", adicional: "Adicionales", cambio: "Cambios", avance: "Avances", problema: "Problemas",
  equipo: "Equipo", documento: "Documentos", whatsapp: "WhatsApp", ia: "Asistente",
};

/** Historial de cambios y registro de operaciones de la obra (solo arquitecto). */
export default async function Historial({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ g?: string }> }) {
  const { id } = await params;
  const { g = "" } = await searchParams;
  await requireObra(id, ["arquitecto"]);
  const filtro = g && GRUPOS[g] ? [like(schema.auditoria.accion, `${g}%`)] : [];
  const regs = await db.query.auditoria.findMany({ where: and(eq(schema.auditoria.obraId, id), ...filtro), orderBy: desc(schema.auditoria.createdAt), limit: 300 });
  const us = regs.length ? await db.query.users.findMany({ where: inArray(schema.users.id, [...new Set(regs.map((r) => r.userId).filter(Boolean) as string[])]) }) : [];
  return (
    <>
      <PageHeader title="Historial de cambios" subtitle="Registro de quién hizo qué, cuándo y por qué canal (web, WhatsApp, asistente o proveedor). No se puede editar ni borrar." />
      <div className="mb-4 flex flex-wrap gap-1.5">
        {Object.entries(GRUPOS).map(([k, v]) => <a key={k} href={`?g=${k}`} className={g === k ? "btn-primary btn-sm" : "btn-secondary btn-sm"}>{v}</a>)}
      </div>
      <Section title={`${regs.length} registros${regs.length === 300 ? " (últimos 300)" : ""}`}>
        <table className="tbl">
          <thead><tr><th>Fecha</th><th>Quién</th><th>Acción</th><th>Detalle</th></tr></thead>
          <tbody>
            {regs.map((r) => (
              <tr key={r.id}>
                <td className="whitespace-nowrap text-xs text-zinc-500">{fechaHora(r.createdAt)}</td>
                <td className="whitespace-nowrap">{us.find((u) => u.id === r.userId)?.nombre ?? (r.accion.includes("proveedor") ? "Proveedor (portal)" : "Sistema")}</td>
                <td className="whitespace-nowrap font-mono text-xs">{r.accion}</td>
                <td className="max-w-xl truncate text-xs text-zinc-600" title={r.detalle ?? ""}>{r.detalle}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>
    </>
  );
}
