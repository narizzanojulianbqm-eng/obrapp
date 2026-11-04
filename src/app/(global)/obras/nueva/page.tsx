import { PageHeader } from "@/components/ui";
import { ObraForm } from "@/components/forms/obra-form";
import { crearObra } from "@/app/actions/obra";

export default function NuevaObra() {
  return (
    <div className="max-w-4xl">
      <PageHeader title="Crear obra" subtitle="Con estos datos se generan automáticamente los rubros, el cómputo, los análisis de precios, el presupuesto y el Gantt. Todo se puede editar después." />
      <ObraForm action={crearObra} nueva />
    </div>
  );
}
