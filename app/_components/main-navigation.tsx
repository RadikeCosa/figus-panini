import Link from "next/link";

const navigationItems = [
  { href: "/album", label: "Álbum" },
  { href: "/quick-entry", label: "Carga rápida" },
  { href: "/missing", label: "Faltantes" },
  { href: "/duplicates", label: "Repetidas" },
  { href: "/backup", label: "Respaldo" },
];

export function MainNavigation() {
  return (
    <nav aria-label="Secciones principales" className="grid grid-cols-2 gap-3">
      {navigationItems.map((item) => (
        <Link
          key={item.href}
          className="flex min-h-14 items-center justify-center rounded-lg border border-zinc-200 bg-white px-3 text-center text-sm font-semibold text-zinc-950 shadow-sm outline-offset-2 transition hover:border-emerald-600 hover:text-emerald-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-700"
          href={item.href}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
