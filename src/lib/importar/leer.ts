import "server-only";
import { leerPlanilla } from "../planillas";
import { filasDesdeTexto, type FilaImportada } from "./texto";

export type Fuente = "planilla" | "pdf" | "word" | "texto" | "foto" | "ia";
export type Lectura = { filas: FilaImportada[]; advertencias: string[]; fuente: Fuente; texto?: string; necesitaOcr?: boolean };

export const TIPO = (f: File) => {
  const n = f.name.toLowerCase();
  if (/\.(xlsx|xlsm|csv)$/.test(n)) return "planilla";
  if (/\.xls$/.test(n)) return "xls";
  if (/\.pdf$/.test(n) || f.type === "application/pdf") return "pdf";
  if (/\.docx$/.test(n)) return "word";
  if (/\.(txt|md)$/.test(n) || f.type.startsWith("text/")) return "texto";
  if (/\.(png|jpe?g|webp|gif|heic)$/.test(n) || f.type.startsWith("image/")) return "foto";
  return "otro";
};

/** Extrae ítems de un archivo sin usar IA (gratis). */
export async function leerSinIA(f: File): Promise<Lectura> {
  const tipo = TIPO(f);
  if (tipo === "planilla") return { ...(await leerPlanilla(f)), fuente: "planilla" };
  if (tipo === "xls") return { filas: [], advertencias: ["Es un Excel viejo (.xls). Abrilo y guardalo como .xlsx, o exportalo a PDF, y subilo de nuevo."], fuente: "planilla" };
  if (tipo === "texto") { const t = await f.text(); return { ...filasDesdeTexto(t), fuente: "texto", texto: t }; }
  if (tipo === "word") {
    const mammoth = await import("mammoth");
    const { value } = await mammoth.extractRawText({ buffer: Buffer.from(await f.arrayBuffer()) });
    return { ...filasDesdeTexto(value), fuente: "word", texto: value };
  }
  if (tipo === "pdf") {
    const { extractText, getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(new Uint8Array(await f.arrayBuffer()));
    const { text } = await extractText(pdf, { mergePages: true });
    if (text.replace(/\s/g, "").length < 40) return { filas: [], advertencias: ["Este PDF es una imagen escaneada (no tiene texto)."], fuente: "pdf", necesitaOcr: true };
    return { ...filasDesdeTexto(text), fuente: "pdf", texto: text };
  }
  if (tipo === "foto") return { filas: [], advertencias: [], fuente: "foto", necesitaOcr: true };
  return { filas: [], advertencias: ["Formato no reconocido. Subí Excel (.xlsx / .csv), PDF, Word (.docx), una foto (.jpg / .png) o pegá el texto."], fuente: "texto" };
}
