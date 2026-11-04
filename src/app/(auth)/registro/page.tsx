import { registrar } from "@/app/actions/auth";
import { AuthForm } from "../auth-form";

export default function Registro() {
  return (
    <>
      <h1 className="h1 mb-1">Crear cuenta</h1>
      <p className="muted mb-6">Arquitectos, clientes y obreros usan la misma cuenta. Si te invitaron a una obra, registrate con ese email.</p>
      <AuthForm modo="registro" action={registrar} />
    </>
  );
}
