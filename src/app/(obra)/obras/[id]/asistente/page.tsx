import { and, asc, eq } from "drizzle-orm";
import { requireObra } from "@/lib/access";
import { db, schema } from "@/lib/db";
import { PageHeader } from "@/components/ui";
import { ActionButton } from "@/components/client";
import { borrarHistorialIA } from "@/app/actions/ia";
import { aiDisponible, cupoIA } from "@/lib/ai";
import { Pregunta } from "./asistente-client";
import { ScrollAbajo } from "../mensajes/chat-client";

const SUG = {
  arquitecto: ["¿Qué tareas están atrasadas?", "¿Qué materiales necesitamos mañana?", "¿Cuánto gastamos esta semana?", "¿Qué pedidos esperan mi aprobación?", "Mandame un resumen del avance"],
  cliente: ["¿Cómo viene avanzando la obra?", "¿Cuánto falta para terminar?", "¿Qué decisiones tengo pendientes?", "¿Cuánto tengo que pagar este mes?"],
  obrero: ["¿Qué tareas tengo?", "Nos faltan 10 bolsas de cemento para mañana", "Hoy somos 3", "¿Cuánto falta para terminar?"],
};

function md(t: string) {
  return t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/\*([^*\n]+)\*/g, "<b>$1</b>").replace(/(^|\s)_([^_\n]+)_/g, "$1<i>$2</i>");
}

export default async function Asistente({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, rol } = await requireObra(id);
  const hist = await db.query.aiMensajes.findMany({ where: and(eq(schema.aiMensajes.obraId, id), eq(schema.aiMensajes.userId, user.id)), orderBy: asc(schema.aiMensajes.createdAt), limit: 100 });
  const cupo = await cupoIA(id);
  return (
    <>
      <PageHeader
        title="Asistente de obra"
        subtitle={<>Responde con los datos reales de la obra y según tu perfil. Es el mismo asistente que atiende por WhatsApp. {aiDisponible() ? `IA: ${cupo.restante} consultas disponibles este mes.` : "IA: PENDIENTE de activación. Hoy responde con reglas y datos reales de la obra; las preguntas abiertas requieren configurar la clave de IA."}</>}
        actions={hist.length > 0 && <ActionButton action={borrarHistorialIA.bind(null, id)}>Borrar historial</ActionButton>}
      />
      <div className="card flex h-[70vh] flex-col">
        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          {hist.length === 0 && <p className="muted py-10 text-center">Hacé una pregunta o probá una sugerencia.</p>}
          {hist.map((m) => {
            const media = (m.acciones as { tipo: string; ids?: string[] }[] | null)?.find((a) => a.tipo === "media")?.ids ?? [];
            return (
              <div key={m.id} className={`flex ${m.rol === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-sm ${m.rol === "user" ? "bg-brand-700 text-white" : "bg-zinc-100"}`}>
                  <div className="whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: md(m.texto) }} />
                  {media.length > 0 && <div className="mt-2 flex gap-1.5">{media.map((d) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <a key={d} href={`/api/archivos/${d}`} target="_blank"><img src={`/api/archivos/${d}`} alt="" className="h-24 rounded" /></a>
                  ))}</div>}
                </div>
              </div>
            );
          })}
          <ScrollAbajo />
        </div>
        <Pregunta obraId={id} sugerencias={SUG[rol]} />
      </div>
    </>
  );
}
