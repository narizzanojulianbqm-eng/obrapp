import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, schema } from "./db";

const COOKIE = "obrapp_session";
const secret = () => {
  const s = process.env.AUTH_SECRET;
  if (!s && process.env.VERCEL) throw new Error("Falta configurar AUTH_SECRET en las variables de entorno");
  return new TextEncoder().encode(s || "dev-secret-solo-para-desarrollo-local-0123456789");
};

export async function createSession(userId: string) {
  const token = await new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secret());
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function destroySession() {
  (await cookies()).delete(COOKIE);
}

export async function getUserId(): Promise<string | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return (payload.sub as string) ?? null;
  } catch {
    return null;
  }
}

export async function getUser() {
  const id = await getUserId();
  if (!id) return null;
  const u = await db.query.users.findFirst({ where: eq(schema.users.id, id) });
  return u ?? null;
}

export async function requireUser() {
  const u = await getUser();
  if (!u) redirect("/login");
  return u;
}
