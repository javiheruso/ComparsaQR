import Link from "next/link";

export default function Home() {
  return (
    <main className="flex-1 flex flex-col items-center justify-center p-6">
      <div className="max-w-md w-full space-y-8 text-center">
        <div className="space-y-2">
          <h1 className="text-4xl font-bold tracking-tight">
            Gestión Barraca
          </h1>
          <p className="text-muted-foreground">
            Control de crédito para socios de la comparsa
          </p>
        </div>

        <div className="space-y-4 pt-4">
          <Link
            href="/scanner"
            className="block w-full py-4 px-6 bg-primary text-primary-foreground rounded-xl text-lg font-semibold hover:opacity-90 transition-opacity"
          >
            Escanear Pulsera
          </Link>

          <Link
            href="/admin"
            className="block w-full py-4 px-6 border border-border rounded-xl text-lg font-semibold hover:bg-muted transition-colors"
          >
            Administración
          </Link>
        </div>
      </div>
    </main>
  );
}
