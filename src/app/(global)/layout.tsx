import { modoDemo } from "@/lib/entorno";
import { Shell, type NavSection } from "@/components/shell";
import { requireUser } from "@/lib/auth";
import { noLeidas, obrasDelUsuario } from "@/lib/queries";

export default async function GlobalLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const [unread, obras] = await Promise.all([noLeidas(user.id), obrasDelUsuario(user)]);
  const sections: NavSection[] = [
    {
      links: [
        { href: "/dashboard", label: "Dashboard", icon: "dashboard" },
        { href: "/obras", label: "Mis obras", icon: "obras", exact: true },
        { href: "/obras/nueva", label: "Crear obra", icon: "nueva" },
      ],
    },
    {
      title: "Obras recientes",
      links: obras.filter((o) => o.obra.estado !== "finalizada").slice(0, 6).map((o) => ({ href: `/obras/${o.obra.id}`, label: o.obra.nombre, icon: "obras" as const })),
    },
    {
      title: "Estudio",
      links: [
        { href: "/whatsapp", label: "WhatsApp", icon: "whatsapp" },
        { href: "/proveedores", label: "Proveedores", icon: "proveedores" },
        { href: "/configuracion", label: "Configuración", icon: "config" },
      ],
    },
  ];
  return (
    <Shell demo={modoDemo()} sections={sections.filter((s) => s.links.length)} userName={user.nombre} unread={unread}>
      {children}
    </Shell>
  );
}
