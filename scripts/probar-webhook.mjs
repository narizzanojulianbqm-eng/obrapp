// Prueba de punta a punta del webhook de WhatsApp con payloads con el formato de Meta (firmados).
// Uso: con el servidor corriendo con WHATSAPP_APP_SECRET y WHATSAPP_VERIFY_TOKEN:
//   WHATSAPP_APP_SECRET=... WHATSAPP_VERIFY_TOKEN=... node scripts/probar-webhook.mjs
import crypto from "node:crypto";
import { createClient } from "@libsql/client";

const URL = process.env.URL ?? "http://localhost:3000/api/whatsapp/webhook";
const SECRET = process.env.WHATSAPP_APP_SECRET ?? "secreto-test";
const VERIFY = process.env.WHATSAPP_VERIFY_TOKEN ?? "verif";
const db = createClient({ url: process.env.DATABASE_URL ?? "file:data/obrapp.db" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function enviar(tel, texto) {
  const id = "wamid.test" + crypto.randomUUID();
  const body = JSON.stringify({
    object: "whatsapp_business_account",
    entry: [{ id: "WABA", changes: [{ field: "messages", value: { messaging_product: "whatsapp", contacts: [{ wa_id: tel, profile: { name: "Test" } }], messages: [{ from: tel, id, timestamp: String((Date.now() / 1000) | 0), type: "text", text: { body: texto } }] } }] }],
  });
  const sig = "sha256=" + crypto.createHmac("sha256", SECRET).update(body).digest("hex");
  const r = await fetch(URL, { method: "POST", headers: { "content-type": "application/json", "x-hub-signature-256": sig }, body });
  if (r.status !== 200) throw new Error("webhook " + r.status);
  for (let k = 0; k < 60; k++) {
    await sleep(250);
    const inn = (await db.execute({ sql: "select rowid as rid, intencion, estado, contacto_id from wa_mensajes where wa_message_id = ?", args: [id] })).rows[0];
    if (inn && inn.estado !== "recibido") {
      await sleep(300);
      const outs = (await db.execute({ sql: "select texto, media_doc_id from wa_mensajes where contacto_id = ? and direccion = 'saliente' and rowid > ? order by rowid", args: [inn.contacto_id, inn.rid] })).rows;
      return { intencion: inn.intencion, outs };
    }
  }
  return { intencion: "(sin respuesta)", outs: [] };
}

async function charla(tel, nombre, msgs) {
  console.log(`\n══════ ${nombre} ══════`);
  for (const m of msgs) {
    const { intencion, outs } = await enviar(tel, m);
    console.log(`\n> ${m}   [${intencion}]`);
    for (const o of outs) console.log((o.texto ?? `[foto ${o.media_doc_id}]`).split("\n").map((l) => "  " + l).join("\n"));
  }
}

const v = await fetch(URL + `?hub.mode=subscribe&hub.verify_token=${VERIFY}&hub.challenge=123`);
console.log("Verificación del webhook:", v.status, await v.text());
const malo = await fetch(URL, { method: "POST", body: "{}", headers: { "x-hub-signature-256": "sha256=00" } });
console.log("Payload con firma inválida →", malo.status);

const grupos = process.argv[2] ? JSON.parse(process.argv[2]) : [
  ["5491150000003", "OBRERO", ["Hola", "Hoy terminamos de levantar las paredes del dormitorio", "70%", "Nos faltan 20 bolsas de cemento para mañana", "No podemos continuar porque todavía no llegó el material", "Terminamos el hormigonado", "no", "Hoy somos 4", "¿Qué tareas tengo?"]],
  ["5491150000001", "ARQUITECTA", ["¿Qué tareas están atrasadas en la obra?", "¿Cuánto gastamos esta semana?", "¿Qué materiales necesitamos comprar mañana?", "¿Cuánto nos queda de presupuesto para instalaciones?", "¿Qué pedidos están esperando mi aprobación?", "aprobar 1", "si", "¿Cuántas personas trabajaron hoy?", "Generame un informe semanal de todas mis obras", "obras", "2"]],
  ["5491150000002", "CLIENTE", ["¿Cómo viene avanzando mi casa?", "¿Cuánto falta para terminar?", "¿Cuánto tengo que pagar este mes?", "¿Me pueden mostrar cómo quedó la mampostería?", "Quiero cambiar el revestimiento de la cocina por uno de porcelanato", "¿Qué decisiones tengo pendientes?", "¿Cuánto gastaron en estructura?"]],
  ["5491199999999", "NÚMERO DESCONOCIDO", ["Hola, ¿cómo va la obra de Los Aromos?"]],
];
for (const [tel, n, msgs] of grupos) await charla(tel, n, msgs);
