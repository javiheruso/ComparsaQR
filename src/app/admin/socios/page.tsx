"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { formatEuro } from "@/lib/utils";
import { Search, Plus, Check, X } from "lucide-react";

interface Socio {
  id: number;
  numeroSocio: string;
  nombre: string;
  credito: number;
  estadoPulsera: string;
  qrToken: string;
}

export default function SociosPage() {
  const [socios, setSocios] = useState<Socio[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchSocios = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      const res = await fetch(`/api/socios?${params}`);
      const data = await res.json();
      setSocios(data.socios ?? []);
    } catch {
      setSocios([]);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchSocios();
    }, 300);
    return () => clearTimeout(timer);
  }, [fetchSocios]);

  const togglePulsera = async (id: number) => {
    await fetch(`/api/socios/${id}/toggle-pulsera`, { method: "PATCH" });
    fetchSocios();
  };

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Socios</h1>
        <Link
          href="/admin/socios/nuevo"
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
        >
          <Plus className="w-4 h-4" />
          Nuevo
        </Link>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nombre o número de socio..."
          className="w-full pl-10 pr-4 py-2.5 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
        />
      </div>

      <div className="bg-white border border-border rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-muted-foreground">Cargando...</div>
        ) : socios.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            No hay socios
          </div>
        ) : (
          <div className="divide-y divide-border">
            {socios.map((socio) => (
              <div
                key={socio.id}
                className="flex items-center gap-4 px-4 py-3 hover:bg-muted/50 transition-colors"
              >
                <Link
                  href={`/admin/socios/${socio.id}`}
                  className="flex-1 flex items-center gap-4 min-w-0"
                >
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-bold text-primary">
                      {socio.nombre.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium truncate">{socio.nombre}</p>
                    <p className="text-xs text-muted-foreground">
                      #{socio.numeroSocio}
                    </p>
                  </div>
                </Link>
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-sm">
                    {formatEuro(socio.credito)}
                  </span>
                  <button
                    onClick={() => togglePulsera(socio.id)}
                    className={`p-1.5 rounded-lg transition-colors ${
                      socio.estadoPulsera === "activa"
                        ? "text-green-600 hover:bg-green-100"
                        : "text-red-600 hover:bg-red-100"
                    }`}
                    title={socio.estadoPulsera === "activa" ? "Desactivar" : "Activar"}
                  >
                    {socio.estadoPulsera === "activa" ? (
                      <Check className="w-4 h-4" />
                    ) : (
                      <X className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
