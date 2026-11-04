import { NextResponse, type NextRequest } from "next/server";

const PUBLICAS = ["/login", "/registro", "/recuperar", "/api/auth", "/api/whatsapp/webhook", "/api/pagos/webhook", "/cotizar/", "/manifest.webmanifest", "/icon", "/apple-icon"];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const tieneSesion = req.cookies.has("obrapp_session");
  if (pathname === "/") return NextResponse.redirect(new URL(tieneSesion ? "/dashboard" : "/login", req.url));
  if (!tieneSesion && !PUBLICAS.some((p) => pathname.startsWith(p))) {
    const url = new URL("/login", req.url);
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ["/((?!_next|favicon.ico|manifest.webmanifest|.*\\.(?:png|jpg|svg|ico)$).*)"] };
