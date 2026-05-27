"use client";

import Link from "next/link";
import { useState } from "react";
import { Menu, X, LogOut } from "lucide-react";
import { useRouter } from "next/navigation";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const router = useRouter();

  const cerrarSesion = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/admin/login");
    router.refresh();
  };

  return (
    <div className="flex-1 flex flex-col">
      <header className="bg-white border-b border-border px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Botón hamburguesa - solo móvil */}
          <button
            onClick={() => setMenuOpen(true)}
            className="md:hidden text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Abrir menú"
          >
            <Menu className="w-6 h-6" />
          </button>
          <Link href="/admin" className="font-bold text-lg">
            Admin
          </Link>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Inicio
          </Link>
          <Link
            href="/scanner"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Escáner
          </Link>
        </div>
      </header>

      <div className="flex-1 flex relative">
        {/* ─── Sidebar escritorio ─────────────────────── */}
        <nav className="hidden md:flex w-56 flex-col bg-white border-r border-border p-4 gap-1 flex-shrink-0">
          <AdminNavLink href="/admin" onClick={() => setMenuOpen(false)}>
            Dashboard
          </AdminNavLink>
          <AdminNavLink href="/admin/socios" onClick={() => setMenuOpen(false)}>
            Socios
          </AdminNavLink>
          <AdminNavLink href="/admin/transacciones" onClick={() => setMenuOpen(false)}>
            Transacciones
          </AdminNavLink>
          <AdminNavLink href="/admin/importar" onClick={() => setMenuOpen(false)}>
            Importar CSV
          </AdminNavLink>
          <AdminNavLink href="/admin/productos" onClick={() => setMenuOpen(false)}>
            Productos
          </AdminNavLink>
          <AdminNavLink href="/admin/qr-masivo" onClick={() => setMenuOpen(false)}>
            QR Masivo
          </AdminNavLink>
          <div className="flex-1" />
          <AdminNavLink href="/admin/login" onClick={() => setMenuOpen(false)}>
            Cambiar Sesión
          </AdminNavLink>
          <button
            onClick={() => { cerrarSesion(); setMenuOpen(false); }}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
          >
            <LogOut className="w-4 h-4" /> Cerrar Sesión
          </button>
        </nav>

        {/* ─── Overlay móvil ──────────────────────────── */}
        {menuOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-40 md:hidden"
            onClick={() => setMenuOpen(false)}
          />
        )}

        {/* ─── Sidebar móvil ──────────────────────────── */}
        <nav
          className={`fixed top-0 left-0 bottom-0 w-64 bg-white z-50 p-4 flex flex-col gap-1 transform transition-transform duration-200 md:hidden ${
            menuOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="flex items-center justify-between mb-4">
            <span className="font-bold text-lg">Admin</span>
            <button
              onClick={() => setMenuOpen(false)}
              className="text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Cerrar menú"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <AdminNavLink href="/admin" onClick={() => setMenuOpen(false)}>
            Dashboard
          </AdminNavLink>
          <AdminNavLink href="/admin/socios" onClick={() => setMenuOpen(false)}>
            Socios
          </AdminNavLink>
          <AdminNavLink href="/admin/transacciones" onClick={() => setMenuOpen(false)}>
            Transacciones
          </AdminNavLink>
          <AdminNavLink href="/admin/importar" onClick={() => setMenuOpen(false)}>
            Importar CSV
          </AdminNavLink>
          <AdminNavLink href="/admin/productos" onClick={() => setMenuOpen(false)}>
            Productos
          </AdminNavLink>
          <AdminNavLink href="/admin/qr-masivo" onClick={() => setMenuOpen(false)}>
            QR Masivo
          </AdminNavLink>
          <div className="flex-1" />
          <AdminNavLink href="/admin/login" onClick={() => setMenuOpen(false)}>
            Cambiar Sesión
          </AdminNavLink>
          <button
            onClick={() => { cerrarSesion(); setMenuOpen(false); }}
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

function AdminNavLink({
  href,
  children,
  onClick,
}: {
  href: string;
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="px-3 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
    >
      {children}
    </Link>
  );
}
