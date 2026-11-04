import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { Empty, PageHeader } from "@/components/ui";
import { ActionButton } from "@/components/client";
import { marcarNotificacionesLeidas } from "@/app/actions/obra";
import { fechaHora } from "@/lib/format";

export default async function Notificaciones() {
  const user = await requireUser();
  const ns = await db.query.notificaciones.findMany({ where: eq(schema.notificaciones.userId, user.id), orderBy: desc(schema.notificaciones.createdAt), limit: 100 });
  return (
    <div className="max-w-3xl">
      <PageHeader title="Notificaciones" actions={ns.some((n) => !n.leida) && <ActionButton action={marcarNotificacionesLeidas}>Marcar todas como leídas</ActionButton>} />
      {ns.length === 0 ? <Empty title="Sin notificaciones" /> : (
        <div className="card divide-y divide-zinc-100">
          {ns.map((n) => (
            <Link key={n.id} href={n.link ?? "#"} className="flex items-start gap-3 px-5 py-3 hover:bg-zinc-50">
              <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.leida ? "bg-transparent" : "bg-brand-500"}`} />
              <span className={`flex-1 text-sm ${n.leida ? "text-zinc-500" : ""}`}>{n.texto}</span>
              <span className="text-xs text-zinc-400">{fechaHora(n.createdAt)}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
