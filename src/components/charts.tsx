// Gráficos simples en SVG renderizados en el servidor (sin dependencias).

export function CurvaAvance({ puntos, hoy, real }: { puntos: { fecha: string; previsto: number }[]; hoy: string; real: number }) {
  if (puntos.length < 2) return null;
  const W = 640, H = 200, P = { l: 36, r: 12, t: 12, b: 26 };
  const x = (i: number) => P.l + (i / (puntos.length - 1)) * (W - P.l - P.r);
  const y = (v: number) => P.t + (1 - v / 100) * (H - P.t - P.b);
  const path = puntos.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.previsto).toFixed(1)}`).join(" ");
  let iHoy = puntos.findIndex((p) => p.fecha >= hoy);
  if (iHoy < 0) iHoy = puntos.length - 1;
  const etiquetas = puntos.filter((_, i) => i % Math.ceil(puntos.length / 6) === 0 || i === puntos.length - 1);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Curva de avance previsto vs real">
      {[0, 25, 50, 75, 100].map((v) => (
        <g key={v}>
          <line x1={P.l} x2={W - P.r} y1={y(v)} y2={y(v)} stroke="#e4e4e7" strokeWidth={1} />
          <text x={P.l - 6} y={y(v) + 3} textAnchor="end" fontSize={10} fill="#71717a">{v}%</text>
        </g>
      ))}
      <path d={path} fill="none" stroke="#a1a1aa" strokeWidth={2} strokeDasharray="4 3" />
      <line x1={x(iHoy)} x2={x(iHoy)} y1={P.t} y2={H - P.b} stroke="#18181b" strokeWidth={1} opacity={0.3} />
      <circle cx={x(iHoy)} cy={y(real)} r={5} fill="#2f6352" />
      <text x={x(iHoy) + 8} y={y(real) - 6} fontSize={11} fill="#254f42" fontWeight={600}>Real {real.toFixed(0)}%</text>
      {etiquetas.map((p) => {
        const i = puntos.indexOf(p);
        return <text key={p.fecha} x={x(i)} y={H - 8} textAnchor="middle" fontSize={10} fill="#71717a">{p.fecha.slice(8, 10)}/{p.fecha.slice(5, 7)}</text>;
      })}
    </svg>
  );
}

export function BarrasHorizontales({ datos, formato }: { datos: { label: string; valor: number; extra?: number }[]; formato: (n: number) => string }) {
  const max = Math.max(...datos.map((d) => Math.max(d.valor, d.extra ?? 0)), 1);
  return (
    <div className="space-y-2.5">
      {datos.map((d) => (
        <div key={d.label}>
          <div className="mb-1 flex justify-between gap-2 text-xs">
            <span className="truncate text-zinc-700">{d.label}</span>
            <span className="shrink-0 tabular-nums text-zinc-500">{formato(d.valor)}{d.extra != null ? ` · real ${formato(d.extra)}` : ""}</span>
          </div>
          <div className="relative h-2 rounded-full bg-zinc-100">
            <div className="absolute h-2 rounded-full bg-zinc-400" style={{ width: `${(d.valor / max) * 100}%` }} />
            {d.extra != null && <div className={`absolute top-0 h-2 rounded-full ${d.extra > d.valor * 1.05 ? "bg-red-500" : "bg-brand-500"}`} style={{ width: `${(d.extra / max) * 100}%`, opacity: 0.9 }} />}
          </div>
        </div>
      ))}
    </div>
  );
}
