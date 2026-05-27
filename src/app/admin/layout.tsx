import Link from "next/link";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex-1 flex flex-col">
      <header className="bg-white border-b border-border px-4 py-3 flex items-center justify-between">
        <Link href="/admin" className="font-bold text-lg">
          Admin
        </Link>
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

      <div className="flex-1 flex">
        <nav className="hidden md:flex w-56 flex-col bg-white border-r border-border p-4 gap-1">
          <AdminNavLink href="/admin">Dashboard</AdminNavLink>
          <AdminNavLink href="/admin/socios">Socios</AdminNavLink>
          <AdminNavLink href="/admin/transacciones">Transacciones</AdminNavLink>
          <AdminNavLink href="/admin/importar">Importar CSV</AdminNavLink>
          <AdminNavLink href="/admin/productos">Productos</AdminNavLink>
          <AdminNavLink href="/admin/qr-masivo">QR Masivo</AdminNavLink>
          <div className="flex-1" />
          <AdminNavLink href="/admin/login">Cambiar Sesión</AdminNavLink>
        </nav>
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
}

function AdminNavLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="px-3 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
    >
      {children}
    </Link>
  );
}
