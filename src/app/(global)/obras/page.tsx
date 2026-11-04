import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { obrasDelUsuario } from "@/lib/queries";
import { Badge, Empty, Estado, PageHeader } from "@/components/ui";
import { ROL_LABEL, num } from "@/lib/format";
import { TIPOS_OBRA } from "@/lib/engine/plantillas";
import { fechaLarga } from "@/lib/engine/calendario";

export default async function Obras() {
  const user = await requireUser();
  const obras = await obrasDelUsuario(user);
  return (
    <>
      <PageHeader title="Mis obras" subtitle={`${obras.length} obras`} actions={<Link href="/obras/nueva" className="btn-primary">+ Nueva obra</Link>} />
      {obras.length === 0 ? (
        <Empty title="Sin obras" action={<Link href="/obras/nueva" className="btn-primary">Crear obra</Link>} />
      ) : (
        <div className="card overflow-x-auto">
          <table className="tbl">
            <thead>
              <tr><th>Obra</th><th>Tipo</th><th className="num">Sup. cubierta</th><th>Inicio</th><th>Mi perfil</th><th>Estado</th></tr>
            </thead>
            <tbody>
              {obras.map(({ obra, rol }) => (
                <tr key={obra.id} className="hover:bg-zinc-50">
                  <td>
                    <Link href={`/obras/${obra.id}`} className="font-medium hover:underline">{obra.nombre}</Link>
                    <div className="text-xs text-zinc-500">{obra.codigo} · {obra.localidad ?? obra.direccion ?? ""}</div>
                  </td>
                  <td>{TIPOS_OBRA[obra.tipo as keyof typeof TIPOS_OBRA] ?? obra.tipo}</td>
                  <td className="num">{num(obra.supCubierta, 1)} m²</td>
                  <td>{fechaLarga(obra.fechaInicio)}</td>
                  <td><Badge>{ROL_LABEL[rol]}</Badge></td>
                  <td><Estado e={obra.estado} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
