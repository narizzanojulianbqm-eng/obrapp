import { NextResponse, type NextRequest } from "next/server";

const PUBLICAS = ["/login", "/registro", "/recuperar", "/api/auth", "/api/whatsapp/webhook", "/api/pagos/webhook", "/cotizar/", "/manifest.webmanifest", "/icon", "/apple-icon", "/acceso-obra"];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const tieneSesion = req.cookies.has("obrapp_session");
  // "/" es la página pública de venta; con sesión iniciada lleva directo a las obras
  if (pathname === "/") return tieneSesion ? NextResponse.redirect(new URL("/dashboard", req.url)) : NextResponse.next();
  if (!tieneSesion && !PUBLICAS.some((p) => pathname.startsWith(p))) {
    const url = new URL("/login", req.url);
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  // La ruta viaja a los server components (permisos del portal del cliente)
  const h = new Headers(req.headers);
  h.set("x-ruta", pathname);
  return NextResponse.next({ request: { headers: h } });
}

export const config = { matcher: ["/((?!_next|favicon.ico|manifest.webmanifest|.*\\.(?:png|jpg|svg|ico)$).*)"] };
