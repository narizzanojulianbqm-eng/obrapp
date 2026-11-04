import { plantillaPara, parametrosPorDefecto, magnitudes, evaluarFormula } from "../src/lib/engine/plantillas";
import { programar, duracionPorRendimiento } from "../src/lib/engine/calculos";
for (const [tipo, sis] of [["vivienda_unifamiliar","tradicional"],["vivienda_unifamiliar","steel_frame"],["refaccion","tradicional"]]) {
  const o = { tipo, sistema: sis, supCubierta: 140, supSemicubierta: 20, niveles: 2 };
  const p = parametrosPorDefecto(o); const m = magnitudes(o, p);
  const pl = plantillaPara(tipo, sis);
  const items: any[] = [];
  const keys = new Set(pl.flatMap(r=>r.items.map(i=>i.key)));
  for (const r of pl) for (const it of r.items) {
    for (const d of it.deps??[]) { const k = typeof d==="string"?d:d.key; if(!keys.has(k)) console.log("DEP FALTANTE", tipo, sis, it.key, k); }
    const q = evaluarFormula(it.formula, m);
    const hh = Object.entries(it.recursos).filter(([k])=>["oficial","ayudante","oficial_esp","pintor","durlockero"].includes(k)).reduce((a,[,v])=>a+v,0);
    items.push({ id: it.key, nombre: it.nombre, q, duracion: it.hito?0:duracionPorRendimiento(q,hh,16,!!it.hito), esHito: !!it.hito, inicioMin: null,
      predecesoras: (it.deps??[]).map(d=>typeof d==="string"?{id:d,tipo:"FC",desfase:0}:{id:d.key,tipo:d.tipo??"FC",desfase:d.desfase??0}) });
  }
  const pr = programar(items, "2026-11-09");
  const fin = [...pr.values()].reduce((a,b)=>b.fin>a?b.fin:a,"");
  console.log(tipo, sis, "items", items.length, "fin", fin);
  if (sis==="tradicional" && tipo!=="refaccion") for (const i of items) console.log(" ", i.id.padEnd(18), String(i.q).padStart(8), "d", String(i.duracion).padStart(3), pr.get(i.id)!.inicio, pr.get(i.id)!.fin);
}
