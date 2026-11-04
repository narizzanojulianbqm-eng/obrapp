import { after } from "next/server";
import { firmaMPValida, sincronizarPreapproval } from "@/lib/pagos";

/** Notificaciones de Mercado Pago (tópico subscription_preapproval). */
export async function POST(req: Request) {
  const url = new URL(req.url);
  const body = (await req.json().catch(() => ({}))) as { type?: string; data?: { id?: string } };
  const id = body.data?.id ?? url.searchParams.get("data.id") ?? "";
  const tipo = body.type ?? url.searchParams.get("type") ?? "";
  if (!id) return new Response("ok");
  if (!firmaMPValida(req, id)) return new Response("Firma inválida", { status: 401 });
  if (tipo.includes("preapproval")) after(() => sincronizarPreapproval(id));
  return new Response("ok");
}
