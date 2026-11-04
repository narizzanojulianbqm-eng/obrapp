"use client";
import { useFormStatus } from "react-dom";
import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";

export function SubmitButton({ children, className = "btn-primary", pendingText }: { children: ReactNode; className?: string; pendingText?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending}>
      {pending ? pendingText ?? "Guardando…" : children}
    </button>
  );
}

/** Botón que pide confirmación antes de ejecutar una acción importante. */
export function ConfirmAction({
  action,
  label,
  title,
  message,
  className = "btn-danger btn-sm",
  confirmLabel = "Confirmar",
}: {
  action: () => Promise<unknown>;
  label: ReactNode;
  title: string;
  message?: string;
  className?: string;
  confirmLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)}>
        {label}
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/40 p-4" onClick={() => !pending && setOpen(false)}>
          <div className="card w-full max-w-sm p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="h2">{title}</div>
            {message && <p className="muted mt-2">{message}</p>}
            {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
            <div className="mt-5 flex justify-end gap-2">
              <button className="btn-secondary" onClick={() => setOpen(false)} disabled={pending}>
                Cancelar
              </button>
              <button
                className="btn-primary"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    try {
                      await action();
                      setOpen(false);
                      router.refresh();
                    } catch (e) {
                      setError(e instanceof Error ? e.message : "Error");
                    }
                  })
                }
              >
                {pending ? "Procesando…" : confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/** Input que guarda al salir del campo (edición en línea de tablas). */
export function InlineNumber({
  value,
  onSave,
  className = "input-sm w-24 text-right",
  step = "any",
  placeholder,
}: {
  value: number | null;
  onSave: (v: number | null) => Promise<unknown>;
  className?: string;
  step?: string;
  placeholder?: string;
}) {
  const [v, setV] = useState(value == null ? "" : String(value));
  const [estado, setEstado] = useState<"idle" | "saving" | "ok" | "err">("idle");
  const router = useRouter();
  const guardar = async () => {
    const nuevo = v.trim() === "" ? null : Number(v.replace(",", "."));
    if (nuevo === value || (nuevo != null && isNaN(nuevo))) return;
    setEstado("saving");
    try {
      await onSave(nuevo);
      setEstado("ok");
      router.refresh();
      setTimeout(() => setEstado("idle"), 800);
    } catch {
      setEstado("err");
    }
  };
  const ring = estado === "ok" ? "ring-2 ring-brand-100 border-brand-500" : estado === "err" ? "border-red-400" : "";
  return (
    <input
      inputMode="decimal"
      step={step}
      className={`${className} ${ring}`}
      value={v}
      placeholder={placeholder}
      onChange={(e) => setV(e.target.value)}
      onBlur={guardar}
      onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
    />
  );
}

export function InlineText({ value, onSave, className = "input-sm w-full" }: { value: string; onSave: (v: string) => Promise<unknown>; className?: string }) {
  const [v, setV] = useState(value);
  const router = useRouter();
  return (
    <input
      className={className}
      value={v}
      onChange={(e) => setV(e.target.value)}
      onBlur={async () => {
        if (v !== value && v.trim()) {
          await onSave(v.trim());
          router.refresh();
        }
      }}
      onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
    />
  );
}

export function ActionButton({ action, children, className = "btn-secondary btn-sm" }: { action: () => Promise<unknown>; children: ReactNode; className?: string }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <button type="button" className={className} disabled={pending} onClick={() => start(async () => { await action(); router.refresh(); })}>
      {pending ? "…" : children}
    </button>
  );
}
