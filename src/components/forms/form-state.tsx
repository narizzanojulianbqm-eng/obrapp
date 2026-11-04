"use client";
import { useActionState, useEffect, useRef, type ReactNode } from "react";
import type { FormState } from "@/app/actions/auth";

/** Formulario con estado (errores / confirmación) para server actions. */
export function ActionForm({
  action,
  children,
  className,
  resetOnOk,
  submitLabel = "Guardar",
  submitClass = "btn-primary",
  hideSubmit,
}: {
  action: (s: FormState, f: FormData) => Promise<FormState>;
  children: ReactNode;
  className?: string;
  resetOnOk?: boolean;
  submitLabel?: string;
  submitClass?: string;
  hideSubmit?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok && resetOnOk) ref.current?.reset();
  }, [state, resetOnOk]);
  return (
    <form ref={ref} action={formAction} className={className}>
      {children}
      {(state?.error || (state?.ok && state.ok !== "enviado")) && (
        <p className={`mt-3 rounded-md px-3 py-2 text-sm ${state.error ? "bg-red-50 text-red-700" : "bg-brand-50 text-brand-700"}`}>{state.error ?? state.ok}</p>
      )}
      {!hideSubmit && (
        <div className="mt-4">
          <button className={submitClass} disabled={pending}>{pending ? "Procesando…" : submitLabel}</button>
        </div>
      )}
    </form>
  );
}
