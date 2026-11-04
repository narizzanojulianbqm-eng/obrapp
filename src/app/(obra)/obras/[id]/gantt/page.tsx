import { requireObra } from "@/lib/access";
import { cargarObra } from "@/lib/obra-service";
import { PageHeader } from "@/components/ui";
import { avancePrevistoItem, finDeObra } from "@/lib/engine/calculos";
import { diasCorridos, fechaLarga, hoyISO } from "@/lib/engine/calendario";
import { Gantt, type GanttItem } from "./gantt-client";

export default async function GanttPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { obra, rol } = await requireObra(id);
  const { rubros, items, miembros } = await cargarObra(id);
  const hoy = hoyISO();
  const nombreRubro = new Map(rubros.map((r) => [r.id, `${r.codigo} ${r.nombre}`]));
  const nombreM = new Map(miembros.map((m) => [m.id, m.nombre ?? m.email]));
  const data: GanttItem[] = items
    .filter((i) => i.inicio && i.fin)
    .map((i) => ({
      id: i.id, nombre: i.nombre, rubro: nombreRubro.get(i.rubroId) ?? "", inicio: i.inicio!, fin: i.fin!, duracion: i.duracion, esHito: i.esHito,
      avanceReal: Math.round(i.avanceReal), previsto: avancePrevistoItem(i, hoy), inicioMin: i.inicioMin, predecesoras: i.predecesoras ?? [],
      responsable: i.asignadoA ? nombreM.get(i.asignadoA) : undefined,
    }));
  const fin = finDeObra(items);
  return (
    <>
      <PageHeader title="Cronograma" subtitle={rol === "arquitecto" ? "Se arma solo con las tareas de la obra. Tocá un rubro para ver sus tareas." : "Fechas previstas y avance de cada etapa de la obra."} />
      <Gantt items={data} hoy={hoy} editable={rol === "arquitecto"} />
    </>
  );
}
