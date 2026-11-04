"use client";
import { useState } from "react";

export function CopiarLink({ link }: { link: string }) {
  const [ok, setOk] = useState(false);
  return (
    <div className="flex items-center gap-1.5">
      <input readOnly value={link} className="input-sm min-w-0 flex-1 text-xs text-zinc-500" onFocus={(e) => e.target.select()} />
      <button type="button" className="btn-secondary btn-sm" onClick={async () => { try { await navigator.clipboard.writeText(link); setOk(true); setTimeout(() => setOk(false), 1500); } catch { /* sin portapapeles */ } }}>
        {ok ? "Copiado" : "Copiar link del proveedor"}
      </button>
    </div>
  );
}
