import Link from "next/link";
import type { ReactNode } from "react";

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="h1">{title}</h1>
        {subtitle && <div className="muted mt-1">{subtitle}</div>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Stat({ label, value, hint, tone }: { label: string; value: ReactNode; hint?: ReactNode; tone?: "ok" | "warn" | "bad" }) {
  const c = tone === "bad" ? "text-red-700" : tone === "warn" ? "text-amber-700" : tone === "ok" ? "text-brand-700" : "text-zinc-900";
  return (
    <div className="card card-pad">
      <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">{label}</div>
      <div className={`mt-1.5 text-2xl font-semibold tabular-nums ${c}`}>{value}</div>
      {hint && <div className="mt-1 text-xs text-zinc-500">{hint}</div>}
    </div>
  );
}

const TONOS: Record<string, string> = {
  gris: "bg-zinc-100 text-zinc-700",
  verde: "bg-brand-50 text-brand-700",
  ambar: "bg-amber-50 text-amber-800",
  rojo: "bg-red-50 text-red-700",
  azul: "bg-sky-50 text-sky-800",
};
export function Badge({ children, tono = "gris" }: { children: ReactNode; tono?: keyof typeof TONOS | string }) {
  return <span className={`badge ${TONOS[tono] ?? TONOS.gris}`}>{children}</span>;
}

export const ESTADO_TONO: Record<string, string> = {
  pendiente: "ambar", aprobada: "verde", aprobado: "verde", rechazada: "rojo", rechazado: "rojo", en_compra: "azul", entregada: "gris",
  prevista: "gris", pedida: "azul", recibida: "verde", pagada: "verde", activa: "verde", pausada: "ambar", finalizada: "gris",
  baja: "gris", media: "azul", alta: "ambar", urgente: "rojo", borrador: "gris", enviada: "azul", cerrada: "verde", elegida: "verde", descartada: "gris",
};
export const ESTADO_LABEL: Record<string, string> = { en_compra: "En compra", mano_obra: "Mano de obra" };
export const Estado = ({ e }: { e: string }) => <Badge tono={ESTADO_TONO[e] ?? "gris"}>{ESTADO_LABEL[e] ?? e.charAt(0).toUpperCase() + e.slice(1)}</Badge>;

export function Empty({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="card flex flex-col items-center px-6 py-12 text-center">
      <div className="h2">{title}</div>
      {children && <div className="muted mt-1 max-w-md">{children}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Progress({ value, previsto, small }: { value: number; previsto?: number; small?: boolean }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div className={`relative w-full overflow-hidden rounded-full bg-zinc-100 ${small ? "h-1.5" : "h-2.5"}`}>
      <div className="h-full rounded-full bg-brand-500" style={{ width: `${v}%` }} />
      {previsto != null && <div className="absolute top-0 h-full w-0.5 bg-zinc-800" style={{ left: `${Math.min(100, previsto)}%` }} title={`Previsto ${previsto.toFixed(0)}%`} />}
    </div>
  );
}

export function Field({ label, children, hint, className }: { label: string; children: ReactNode; hint?: string; className?: string }) {
  return (
    <label className={`block ${className ?? ""}`}>
      <span className="label">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-zinc-400">{hint}</span>}
    </label>
  );
}

export function Section({ title, actions, children, className }: { title: string; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`card ${className ?? ""}`}>
      <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-3.5">
        <h2 className="h2">{title}</h2>
        {actions}
      </div>
      <div>{children}</div>
    </section>
  );
}

export function Alerta({ nivel, texto, link }: { nivel: "info" | "aviso" | "critico"; texto: string; link?: string }) {
  const c = nivel === "critico" ? "border-red-200 bg-red-50 text-red-800" : nivel === "aviso" ? "border-amber-200 bg-amber-50 text-amber-900" : "border-zinc-200 bg-zinc-50 text-zinc-700";
  const body = <div className={`rounded-lg border px-3 py-2 text-sm ${c}`}>{texto}</div>;
  return link ? <Link href={link} className="block hover:opacity-90">{body}</Link> : body;
}
