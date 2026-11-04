import { and, eq, gte, sql } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { PLANES, type PlanKey } from "@/lib/planes";
import { PageHeader, Progress } from "@/components/ui";
import { ActionButton } from "@/components/client";
import { cambiarPlan, setAvisosEmail } from "@/app/actions/obra";
import { aiDisponible } from "@/lib/ai";
import { mpActivo, precioPlan } from "@/lib/pagos";
import { ars } from "@/lib/format";
import { ActionForm } from "@/components/forms/form-state";
import { generarCodigoVinculacion } from "@/app/actions/whatsapp";
import { telefonoLegible } from "@/lib/whatsapp/telefono";
import { Badge } from "@/components/ui";

export default async function Configuracion() {
  const user = await requireUser();
  const inicioMes = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const [{ n, tin, tout }] = await db
    .select({ n: sql<number>`count(*)`, tin: sql<number>`coalesce(sum(tokens_entrada),0)`, tout: sql<number>`coalesce(sum(tokens_salida),0)` })
    .from(schema.aiUso)
    .where(and(eq(schema.aiUso.userId, user.id), gte(schema.aiUso.createdAt, inicioMes)));
  const [{ activas }] = await db.select({ activas: sql<number>`count(*)` }).from(schema.obras).where(and(eq(schema.obras.ownerId, user.id), eq(schema.obras.estado, "activa")));
  const plan = PLANES[user.plan];
  const miWa = await db.query.waContactos.findFirst({ where: eq(schema.waContactos.userId, user.id) });
  return (
    <>
      <PageHeader title="Configuración" subtitle={`${user.nombre} · ${user.email}`} />
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card card-pad">
          <div className="h2">Uso del plan {plan.nombre}</div>
          <div className="mt-4 space-y-4 text-sm">
            <div>
              <div className="mb-1 flex justify-between"><span>Obras activas</span><span className="tabular-nums">{Number(activas)} / {plan.obrasActivas}</span></div>
              <Progress value={(Number(activas) / plan.obrasActivas) * 100} />
            </div>
            <div>
              <div className="mb-1 flex justify-between"><span>Consultas al asistente IA este mes</span><span className="tabular-nums">{Number(n)} / {plan.consultasIA}</span></div>
              <Progress value={(Number(n) / plan.consultasIA) * 100} />
              <div className="mt-1 text-xs text-zinc-500">{Number(tin).toLocaleString("es-AR")} tokens de entrada · {Number(tout).toLocaleString("es-AR")} de salida</div>
            </div>
            <div className="rounded-lg bg-zinc-50 p-3 text-xs text-zinc-600">
              Asistente IA: {aiDisponible() ? "conectado (la plataforma paga el consumo de forma centralizada)." : "PENDIENTE de activación (falta ANTHROPIC_API_KEY en el servidor). Mientras tanto se usa el análisis automático sin IA."}
            </div>
          </div>
        </div>
        <div className="card card-pad">
          <div className="h2 mb-4">Planes</div>
          <div className="space-y-3">
            {(Object.keys(PLANES) as PlanKey[]).map((k) => (
              <div key={k} className={`flex items-center justify-between rounded-lg border p-3 ${k === user.plan ? "border-brand-500 bg-brand-50" : "border-zinc-200"}`}>
                <div>
                  <div className="text-sm font-medium">{PLANES[k].nombre} <span className="font-normal text-zinc-500">· {k === "gratuito" ? "sin cargo" : precioPlan(k) ? `${ars(precioPlan(k))}/mes` : "precio a definir"}</span></div>
                  <div className="text-xs text-zinc-500">{PLANES[k].descripcion} {PLANES[k].obrasActivas} obras activas · {PLANES[k].consultasIA} consultas IA/mes · {PLANES[k].miembrosPorObra} miembros por obra</div>
                </div>
                {k === user.plan ? <span className="text-xs font-medium text-brand-700">Actual</span> : <ActionButton action={cambiarPlan.bind(null, k)}>Cambiar</ActionButton>}
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-zinc-400">{mpActivo() ? "El pago mensual se procesa con Mercado Pago. El plan se activa cuando se autoriza el débito." : "Modo prueba: no hay credenciales de Mercado Pago configuradas, el cambio de plan es inmediato y sin cobro."}</p>
        </div>
        <div className="card card-pad lg:col-span-2">
          <div className="flex items-center justify-between">
            <div className="h2">Mi WhatsApp</div>
            {miWa && <Badge tono={miWa.estado === "activo" ? "verde" : "ambar"}>{telefonoLegible(miWa.telefono)} · {miWa.estado}</Badge>}
          </div>
          <p className="muted mt-1">Vinculá tu número para consultar tus obras, aprobar pedidos y recibir avisos por WhatsApp. Si no usás WhatsApp, los avisos importantes te llegan por email.</p>
          <div className="mt-3 flex items-center gap-2 text-sm">
            Avisos por email: <ActionButton action={setAvisosEmail.bind(null, !user.avisosEmail)}>{user.avisosEmail ? "Activados — desactivar" : "Desactivados — activar"}</ActionButton>
          </div>
          <ActionForm action={generarCodigoVinculacion} submitLabel="Generar código de vinculación" className="mt-3 max-w-md">
            <input name="telefono" className="input" placeholder="11 5555 4444" inputMode="tel" required defaultValue={user.telefono ?? ""} />
          </ActionForm>
        </div>
      </div>
    </>
  );
}
