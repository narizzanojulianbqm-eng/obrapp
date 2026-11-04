import { NuevaObraWizard } from "@/components/forms/nueva-obra-wizard";
import { crearObra } from "@/app/actions/obra";

export default function NuevaObra() {
  return (
    <div className="py-2">
      <h1 className="mb-1 text-center text-2xl font-semibold tracking-tight">Nueva obra</h1>
      <p className="mb-8 text-center text-[15px] text-zinc-500">Tres pasos y listo.</p>
      <NuevaObraWizard action={crearObra} />
    </div>
  );
}
