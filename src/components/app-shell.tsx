"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Menu, X, LogOut } from "lucide-react";
import { useRouter, usePathname } from "next/navigation";

interface SessionInfo {
  authenticated: boolean;
  tipo: string;
  nombre: string | null;
  permiso: string | null;
  puntoNombre: string | null;
}

interface NavItem {
  href: string;
  label: string;
  adminOnly: boolean;
}

const navItems: NavItem[] = [
  { href: "/admin", label: "Dashboard", adminOnly: true },
  { href: "/admin/socios", label: "Socios", adminOnly: true },
  { href: "/admin/transacciones", label: "Transacciones", adminOnly: true },
  { href: "/admin/importar", label: "Importar Socios", adminOnly: true },
  { href: "/admin/productos", label: "Productos", adminOnly: true },
  { href: "/admin/puntos", label: "Puntos", adminOnly: true },
  { href: "/admin/qr-masivo", label: "QR Masivo", adminOnly: true },
  { href: "/admin/recargar", label: "Recarga Masiva", adminOnly: true },
  { href: "/scanner", label: "Escanear Pulsera", adminOnly: false },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [checking, setChecking] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  const isLoginPage = pathname === "/";

  useEffect(() => {
    if (isLoginPage) {
      setChecking(false);
      return;
    }

    fetch("/api/auth/me")
      .then((res) => {
        if (!res.ok) throw new Error("No autenticado");
        return res.json();
      })
      .then((data) => {
        setSession(data);
        setChecking(false);
      })
      .catch(() => {
        router.replace("/");
      });
  }, [router, isLoginPage]);

  if (isLoginPage) {
    return <>{children}</>;
  }

  if (checking) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <p className="text-muted-foreground">Cargando...</p>
      </div>
    );
  }

  if (!session) return null;

  const esAdmin = session.tipo === "admin";
  const mostrarNombre = session.nombre || session.puntoNombre || "---";

  return (
    <div className="flex-1 flex flex-col">
      <header className="bg-white border-b border-border px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setMenuOpen(true)}
            className="md:hidden text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Abrir menú"
          >
            <Menu className="w-6 h-6" />
          </button>
          <span className="font-bold text-lg">{mostrarNombre}</span>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Inicio
          </Link>
        </div>
      </header>

      <div className="flex-1 flex relative">
        {/* Sidebar escritorio */}
        <nav className="hidden md:flex w-56 flex-col bg-white border-r border-border p-4 gap-1 flex-shrink-0">
          {navItems
            .filter((item) => esAdmin || !item.adminOnly)
            .map((item) => (
              <NavLink
                key={item.href}
                href={item.href}
                active={pathname.startsWith(item.href)}
                onClick={() => setMenuOpen(false)}
              >
                {item.label}
              </NavLink>
            ))}
          <div className="flex-1" />
          <button
            onClick={async () => {
              await fetch("/api/auth/logout", { method: "POST" });
              router.replace("/");
            }}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
          >
            <LogOut className="w-4 h-4" /> Cerrar Sesión
          </button>
        </nav>

        {/* Overlay móvil */}
        {menuOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-40 md:hidden"
            onClick={() => setMenuOpen(false)}
          />
        )}

        {/* Sidebar móvil */}
        <nav
          className={`fixed top-0 left-0 bottom-0 w-64 bg-white z-50 p-4 flex flex-col gap-1 transform transition-transform duration-200 md:hidden ${
            menuOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="flex items-center justify-between mb-4">
            <span className="font-bold text-lg">{mostrarNombre}</span>
            <button
              onClick={() => setMenuOpen(false)}
              className="text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Cerrar menú"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {navItems
            .filter((item) => esAdmin || !item.adminOnly)
            .map((item) => (
              <NavLink
                key={item.href}
                href={item.href}
                active={pathname.startsWith(item.href)}
                onClick={() => setMenuOpen(false)}
              >
                {item.label}
              </NavLink>
            ))}
          <div className="flex-1" />
          <button
            onClick={async () => {
              await fetch("/api/auth/logout", { method: "POST" });
              router.replace("/");
              setMenuOpen(false);
            }}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
          >
            <LogOut className="w-4 h-4" /> Cerrar Sesión
          </button>
        </nav>

        {/* Contenido principal */}
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
}

function NavLink({
  href,
  children,
  active,
  onClick,
}: {
  href: string;
  children: React.ReactNode;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
        active
          ? "bg-primary/10 text-primary"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      }`}
    >
      {children}
    </Link>
  );
}
