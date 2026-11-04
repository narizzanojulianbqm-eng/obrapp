import ExcelJS from "exceljs";
import { getUser } from "@/lib/auth";
import { rolEnObra } from "@/lib/access";
import { resumenObra } from "@/lib/queries";
import { computoMateriales } from "@/lib/engine/calculos";

/** Exporta presupuesto (con fórmulas), cómputo y cronograma a Excel. Solo el arquitecto. */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getUser();
  if (!user) return new Response("No autorizado", { status: 401 });
  const acc = await rolEnObra(user.id, user.email, id);
  if (!acc || acc.rol !== "arquitecto") return new Response("No encontrado", { status: 404 });
  const r = await resumenObra(id);
  const { obra, presupuesto: p } = r;
  const wb = new ExcelJS.Workbook();
  wb.creator = "Obrapp";
  const moneda = '"$" #,##0.00';
  const negrita = { bold: true };

  // Presupuesto con fórmulas vivas
  const ws = wb.addWorksheet("Presupuesto");
  ws.columns = [{ width: 9 }, { width: 58 }, { width: 8 }, { width: 12 }, { width: 16 }, { width: 18 }];
  ws.addRow([obra.nombre]).font = { bold: true, size: 14 };
  ws.addRow([`${obra.codigo} · ${[obra.direccion, obra.localidad].filter(Boolean).join(", ")} · ${obra.supCubierta} m²`]);
  ws.addRow([]);
  ws.addRow(["Ítem", "Descripción", "Un.", "Cantidad", "P. unitario", "Parcial"]).font = negrita;
  const subtotales: string[] = [];
  for (const fr of p.rubros) {
    const filaRubro = ws.addRow([fr.rubro.codigo, fr.rubro.nombre.toUpperCase()]);
    filaRubro.font = negrita;
    const desde = ws.rowCount + 1;
    fr.items.forEach((x, k) => {
      const row = ws.addRow([`${fr.rubro.codigo}.${String(k + 1).padStart(2, "0")}`, x.item.nombre, x.item.unidad, Number(x.cantidad.toFixed(2)), Number(x.apu.unitario.toFixed(2))]);
      row.getCell(6).value = { formula: `D${row.number}*E${row.number}`, result: x.parcial };
    });
    const hasta = ws.rowCount;
    filaRubro.getCell(6).value = hasta >= desde ? { formula: `SUM(F${desde}:F${hasta})`, result: fr.subtotal } : 0;
    subtotales.push(`F${filaRubro.number}`);
  }
  ws.addRow([]);
  const cd = ws.addRow(["", "COSTO DIRECTO", "", "", "", { formula: subtotales.join("+") || "0", result: p.costoDirecto }]);
  const gg = ws.addRow(["", `Gastos generales (${obra.gastosGeneralesPct}%)`, "", "", obra.gastosGeneralesPct / 100, { formula: `F${cd.number}*E${cd.number + 1}`, result: p.gastosGenerales }]);
  const co = ws.addRow(["", "Costo de obra", "", "", "", { formula: `F${cd.number}+F${gg.number}`, result: p.costoObra }]);
  const be = ws.addRow(["", `Beneficio (${obra.beneficioPct}%)`, "", "", obra.beneficioPct / 100, { formula: `F${co.number}*E${co.number + 1}`, result: p.beneficio }]);
  const ho = ws.addRow(["", `Honorarios (${obra.honorariosPct}%)`, "", "", obra.honorariosPct / 100, { formula: `(F${co.number}+F${be.number})*E${be.number + 1}`, result: p.honorarios }]);
  const st = ws.addRow(["", "Subtotal sin IVA", "", "", "", { formula: `F${co.number}+F${be.number}+F${ho.number}`, result: p.subtotalSinIva }]);
  const iva = ws.addRow(["", `IVA (${obra.ivaPct}%)`, "", "", obra.ivaPct / 100, { formula: `F${st.number}*E${st.number + 1}`, result: p.iva }]);
  const tot = ws.addRow(["", "TOTAL", "", "", "", { formula: `F${st.number}+F${iva.number}`, result: p.total }]);
  [cd, co, st, tot].forEach((x) => (x.font = negrita));
  [gg, be, ho, iva].forEach((x) => (x.getCell(5).numFmt = "0.0%"));
  ws.getColumn(5).numFmt = moneda;
  ws.getColumn(6).numFmt = moneda;
  [gg, be, ho, iva].forEach((x) => (x.getCell(5).numFmt = "0.0%"));

  // Cómputo
  const wc = wb.addWorksheet("Cómputo");
  wc.columns = [{ header: "Tipo", width: 14 }, { header: "Insumo", width: 50 }, { header: "Unidad", width: 10 }, { header: "Cantidad", width: 14 }, { header: "Precio", width: 16 }, { header: "Total", width: 18 }];
  wc.getRow(1).font = negrita;
  for (const f of computoMateriales(r.items, r.recursos, r.insumos)) {
    const row = wc.addRow([f.insumo.tipo.replace("_", " "), f.insumo.nombre, f.insumo.unidad, f.cantidad, f.insumo.precio]);
    row.getCell(6).value = { formula: `D${row.number}*E${row.number}`, result: f.total };
  }
  wc.getColumn(5).numFmt = moneda;
  wc.getColumn(6).numFmt = moneda;

  // Cronograma
  const wg = wb.addWorksheet("Cronograma");
  wg.columns = [{ header: "Rubro", width: 28 }, { header: "Tarea", width: 50 }, { header: "Inicio", width: 12 }, { header: "Fin", width: 12 }, { header: "Días hábiles", width: 12 }, { header: "Avance real %", width: 14 }];
  wg.getRow(1).font = negrita;
  for (const it of r.items) wg.addRow([r.rubros.find((x) => x.id === it.rubroId)?.nombre, it.nombre, it.inicio, it.fin, it.duracion, it.avanceReal]);

  const buf = await wb.xlsx.writeBuffer();
  const nombre = `${obra.codigo}-${obra.nombre}`.replace(/[^\w\-]+/g, "_").slice(0, 60);
  return new Response(new Uint8Array(buf as ArrayBuffer), {
    headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename="${nombre}.xlsx"` },
  });
}
