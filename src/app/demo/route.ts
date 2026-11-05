import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { createSession } from "@/lib/auth";
import { modoDemo } from "@/lib/entorno";

const CUENTAS = { arquitecto: "arquitecta@demo.com", cliente: "cliente@demo.com", obrero: "obrero@demo.com" } as const;

/** Entrar a la demo sin crear cuenta: /demo?rol=arquitecto|cliente|obrero */
export async function GET(req: NextRequest) {
  const base = new URL("/", req.url);
  if (!modoDemo()) return NextResponse.redirect(new URL("/registro", base));
  const rol = (req.nextUrl.searchParams.get("rol") ?? "arquitecto") as keyof typeof CUENTAS;
  const email = CUENTAS[rol] ?? CUENTAS.arquitecto;
  const u = await db.query.users.findFirst({ where: eq(schema.users.email, email) });
  if (!u) return NextResponse.redirect(new URL("/login", base));
  await createSession(u.id);
  const obra = await db.query.obras.findFirst({ where: eq(schema.obras.codigo, "OB-2026-0001") });
  const destino = obra ? (`/obras/${obra.id}`) : "/dashboard";
  return NextResponse.redirect(new URL(destino, base));
}
