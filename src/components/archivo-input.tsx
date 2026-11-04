"use client";
import type { ChangeEvent, InputHTMLAttributes } from "react";

/** Reduce fotos del celular (a veces 5-10 MB) a JPEG de hasta 1920 px antes de subirlas. */
export async function comprimirImagen(f: File, max = 1920, calidad = 0.82): Promise<File> {
  if (!f.type.startsWith("image/") || f.type === "image/gif" || f.size < 600 * 1024) return f;
  try {
    const bmp = await createImageBitmap(f);
    const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const c = document.createElement("canvas");
    c.width = Math.round(bmp.width * k);
    c.height = Math.round(bmp.height * k);
    c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
    const blob = await new Promise<Blob | null>((r) => c.toBlob(r, "image/jpeg", calidad));
    if (!blob || blob.size >= f.size) return f;
    return new File([blob], f.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch {
    return f;
  }
}

/** Reemplaza los archivos del input por versiones comprimidas. */
export async function comprimirInput(input: HTMLInputElement) {
  if (!input.files?.length) return;
  const dt = new DataTransfer();
  for (const f of Array.from(input.files)) dt.items.add(await comprimirImagen(f));
  input.files = dt.files;
}

export function ArchivoInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      type="file"
      {...props}
      className={props.className ?? "block w-full text-sm text-zinc-600 file:mr-3 file:rounded-md file:border-0 file:bg-zinc-100 file:px-3 file:py-1.5 file:text-sm"}
      onChange={async (e: ChangeEvent<HTMLInputElement>) => { await comprimirInput(e.currentTarget); props.onChange?.(e); }}
    />
  );
}
