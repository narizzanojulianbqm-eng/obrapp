import "server-only";
import ExcelJS from "exceljs";
import { normalizar } from "./asistente/texto";
import { parseMonto } from "./format";

export type FilaImportada = { rubro: string; nombre: string; unidad: string; cantidad: number; precio: number | null; duracion: number | null };

/** Lee una planilla existente (XLSX o CSV) de rubros / ítems, detectando columnas por su encabezado. */
export async function leerPlanilla(file: File): Promise<{ filas: FilaImportada[]; advertencias: string[] }> {
  const buf = Buffer.from(await file.arrayBuffer());
  let matriz: string[][] = [];
  if (/\.csv$|\.txt$/i.test(file.name) || file.type.includes("csv")) {
    const txt = buf.toString("utf8").replace(/^﻿/, "");
    const sep = (txt.split("\n")[0].match(/;/g)?.length ?? 0) > (txt.split("\n")[0].match(/,/g)?.length ?? 0) ? ";" : ",";
    matriz = txt.split(/\r?\n/).map((l) => partirCSV(l, sep));
  } else {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf as unknown as ArrayBuffer);
    const ws = wb.worksheets[0];
    ws.eachRow({ includeEmpty: false }, (row) => {
      const vals: string[] = [];
      row.eachCell({ includeEmpty: true }, (cell, col) => {
        const v = cell.value as unknown;
        vals[col - 1] = v == null ? "" : typeof v === "object" && v && "result" in v ? String((v as { result: unknown }).result ?? "") : typeof v === "object" && v && "richText" in v ? (v as { richText: { text: string }[] }).richText.map((t) => t.text).join("") : String(v);
      });
      matriz.push(vals.map((x) => x ?? ""));
    });
  }
  return interpretar(matriz);
}

function partirCSV(linea: string, sep: string): string[] {
  const out: string[] = [];
  let cur = "", q = false;
  for (let i = 0; i < linea.length; i++) {
    const ch = linea[i];
    if (ch === '"') { if (q && linea[i + 1] === '"') { cur += '"'; i++; } else q = !q; }
    else if (ch === sep && !q) { out.push(cur); cur = ""; }
    else cur += ch;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

function interpretar(m: string[][]) {
  const adv: string[] = [];
  // encabezado: primera fila (de las primeras 15) que tenga "descrip"/"item"/"tarea" y "cant" o "unid"
  let h = -1;
  const col = { rubro: -1, nombre: -1, unidad: -1, cantidad: -1, precio: -1, duracion: -1 };
  for (let i = 0; i < Math.min(15, m.length); i++) {
    const n = m[i].map((c) => normalizar(String(c)));
    const idx = (re: RegExp) => n.findIndex((c) => re.test(c));
    const nombre = idx(/descrip|tarea|^item$|designacion|concepto|trabajo/);
    const cant = idx(/^cant|cantidad|cómputo|computo/);
    const unid = idx(/^un|unidad|^u\.?$/);
    if (nombre >= 0 && (cant >= 0 || unid >= 0)) {
      h = i;
      Object.assign(col, { nombre, cantidad: cant, unidad: unid, rubro: idx(/rubro|capitulo|etapa/), precio: idx(/precio|p\.? ?unit|unitario|costo unit/), duracion: idx(/durac|dias/) });
      break;
    }
  }
  if (h < 0) return { filas: [], advertencias: ["No encontré el encabezado. La planilla necesita columnas como: Rubro, Descripción, Unidad, Cantidad (y opcional Precio unitario, Duración)."] };
  const filas: FilaImportada[] = [];
  let rubroActual = "Varios";
  for (let i = h + 1; i < m.length; i++) {
    const r = m[i];
    const nombre = String(r[col.nombre] ?? "").trim();
    const unidad = col.unidad >= 0 ? String(r[col.unidad] ?? "").trim() : "";
    const cantRaw = col.cantidad >= 0 ? String(r[col.cantidad] ?? "").trim() : "";
    const rubroCol = col.rubro >= 0 ? String(r[col.rubro] ?? "").trim() : "";
    if (!nombre && !rubroCol) continue;
    if (rubroCol && rubroCol !== rubroActual && !nombre) { rubroActual = rubroCol; continue; }
    if (rubroCol) rubroActual = rubroCol;
    // fila de título de rubro: sin unidad ni cantidad
    if (nombre && !unidad && !cantRaw) { rubroActual = nombre.replace(/^\d+[.\-)\s]*/, "").trim() || nombre; continue; }
    if (/^(sub)?total/i.test(nombre)) continue;
    const cantidad = parseMonto(cantRaw);
    const precio = col.precio >= 0 && String(r[col.precio] ?? "").trim() ? parseMonto(r[col.precio]) : null;
    const duracion = col.duracion >= 0 ? Math.round(parseMonto(r[col.duracion])) || null : null;
    filas.push({ rubro: capitalizar(rubroActual), nombre: nombre.replace(/^\d+([.,]\d+)*[.\-)\s]+/, ""), unidad: unidad || "gl", cantidad, precio, duracion });
  }
  if (!filas.length) adv.push("No se encontraron ítems debajo del encabezado.");
  if (filas.some((f) => !f.cantidad)) adv.push(`${filas.filter((f) => !f.cantidad).length} ítems vienen sin cantidad.`);
  return { filas: filas.slice(0, 500), advertencias: adv };
}

const capitalizar = (s: string) => (s === s.toUpperCase() ? s.charAt(0) + s.slice(1).toLowerCase() : s);
