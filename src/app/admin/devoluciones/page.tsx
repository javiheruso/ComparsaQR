"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { formatEuro } from "@/lib/utils";
import { ArrowLeft, Wallet } from "lucide-react";

interface Socio {
  id: number;
  numeroSocio: string;
  nombre: string;
  apellido1: string | null;
  apellido2: string | null;
  credito: number;
  creditoNoRetornable: number;
}

export default function DevolucionesPage() {
  const router = useRouter();
  const [socios, setSocios] = useState<Socio[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<number | null>(null);
  const [resultado, setResultado] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams({ limit: "500" });
    fetch(`/api/socios?${params}`)
      .then((res) => {
        if (res.status === 401) { window.location.href = "/"; return; }
        return res.json();
      })
      .then((data) => {
        const conSaldo = (data.socios ?? []).filter(
          (s: Socio) => s.credito - s.creditoNoRetornable > 0
        );
        setSocios(conSaldo);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const devolverIndividual = async (socio: Socio) => {
    const retornable = socio.credito - socio.creditoNoRetornable;
    if (!confirm(`¿Devolver ${formatEuro(retornable)} a ${socio.nombre}?`)) return;

    setProcessing(socio.id);
    setError(null);

    try {
      const res = await fetch(`/api/socios/${socio.id}/devolver`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cantidad: retornable }),
      });

      if (res.status === 401) { window.location.href = "/"; return; }
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Error al devolver");
      }

      setSocios((prev) => prev.filter((s) => s.id !== socio.id));
      setResultado(`Devueltos ${formatEuro(retornable)} a ${socio.nombre}`);
      setTimeout(() => setResultado(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
      setTimeout(() => setError(null), 3000);
    } finally {
      setProcessing(null);
    }
  };

  const devolverTodo = async () => {
    const total = socios.reduce((sum, s) => sum + (s.credito - s.creditoNoRetornable), 0);
    if (!confirm(`¿Devolver ${formatEuro(total)} a todos los socios (${socios.length})?`)) return;

    setProcessing(-1);
    setError(null);

    try {
      const res = await fetch("/api/socios/devolver-masivo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (res.status === 401) { window.location.href = "/"; return; }
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Error al devolver");
      }

      const data = await res.json();
      setSocios([]);
      setResultado(`Devueltos ${formatEuro(data.totalDevuelto)} a ${data.procesados} socio(s)`);
      setTimeout(() => setResultado(null), 5000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
      setTimeout(() => setError(null), 3000);
    } finally {
      setProcessing(null);
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-4">
      <button
        onClick={() => router.back()}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="w-4 h-4" /> Volver
      </button>

      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Wallet className="w-6 h-6" /> Devoluciones
        </h1>
        {socios.length > 0 && (
          <button
            onClick={devolverTodo}
            disabled={processing === -1}
            className="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 disabled:opacity-50 transition-colors"
          >
            {processing === -1 ? "Procesando..." : "Devolver todo"}
          </button>
        )}
      </div>

      {resultado && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-center">
          <p className="text-green-700 text-sm font-medium">{resultado}</p>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-center">
          <p className="text-red-700 text-sm font-medium">{error}</p>
        </div>
      )}

      <div className="bg-white border border-border rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-muted-foreground">Cargando...</div>
        ) : socios.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            No hay socios con saldo retornable
          </div>
        ) : (
          <div className="divide-y divide-border">
            {socios.map((socio) => {
              const retornable = socio.credito - socio.creditoNoRetornable;
              return (
                <div
                  key={socio.id}
                  className="flex items-center gap-4 px-4 py-3 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">
                      {socio.nombre}
                      {socio.apellido1 ? ` ${socio.apellido1}` : ""}
                      {socio.apellido2 ? ` ${socio.apellido2}` : ""}
                    </p>
                    <p className="text-xs text-muted-foreground">#{socio.numeroSocio}</p>
                  </div>
                  <div className="text-right text-sm">
                    <p className="text-muted-foreground">
                      Total: {formatEuro(socio.credito)}
                    </p>
                    <p className="text-muted-foreground">
                      No retornable: {formatEuro(socio.creditoNoRetornable)}
                    </p>
                    <p className="font-semibold text-green-600">
                      Retornable: {formatEuro(retornable)}
                    </p>
                  </div>
                  <button
                    onClick={() => devolverIndividual(socio)}
                    disabled={processing === socio.id}
                    className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-colors"
                  >
                    {processing === socio.id ? "..." : "Devolver"}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
