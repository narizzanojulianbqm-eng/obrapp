import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = { title: "Obrapp — Gestión integral de obras", description: "Planificación, cómputo, presupuesto y comunicación de obras en un solo lugar.", appleWebApp: { capable: true, title: "Obrapp", statusBarStyle: "default" } };
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#254f42" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-AR">
      <body>{children}</body>
    </html>
  );
}
