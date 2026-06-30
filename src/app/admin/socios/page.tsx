"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { formatEuro } from "@/lib/utils";
import { Search, Plus, Check, X, Download } from "lucide-react";

interface Socio {
  id: number;
  numeroSocio: string;
  nombre: string;
  apellido1: string | null;
  apellido2: string | null;
  credito: number;
  estadoPulsera: string;
  qrToken: string;
}

const PAGE_SIZE = 50;

export default function SociosPage() {
  const [socios, setSocios] = useState<Socio[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [exportando, setExportando] = useState(false);

  const fetchSocios = useCallback(async (pagina?: number) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      params.set("page", String(pagina ?? page));
      params.set("limit", String(PAGE_SIZE));
      const res = await fetch(`/api/socios?${params}`);
      const data = await res.json();
      setSocios(data.socios ?? []);
      setTotalPages(data.totalPages ?? 1);
    } catch {
      setSocios([]);
    } finally {
      setLoading(false);
    }
  }, [search, page]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
      fetchSocios(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    fetchSocios();
  }, [page]);

  const togglePulsera = async (id: number, nombre: string, estadoActual: string, apellido1?: string, apellido2?: string) => {
    const nombreCompleto = `${nombre}${apellido1 ? ` ${apellido1}` : ""}${apellido2 ? ` ${apellido2}` : ""}`;
    if (!confirm(`¿${estadoActual === "activa" ? "Desactivar" : "Activar"} la pulsera de ${nombreCompleto}?`)) return;
    await fetch(`/api/socios/${id}/toggle-pulsera`, { method: "PATCH" });
    fetchSocios();
  };

  const exportarCSV = async (todos: boolean) => {
    if (todos) setExportando(true);
    try {
      let data: Socio[];
      if (todos) {
        const res = await fetch("/api/socios?limit=9999&search=" + encodeURIComponent(search));
        const json = await res.json();
        data = json.socios ?? [];
      } else {
        data = socios;
      }
      const cabecera = "Nº Socio,Nombre,Apellido1,Apellido2,Crédito,Estado";
      const filas = data.map((s) => `${s.numeroSocio},"${s.nombre}","${s.apellido1 ?? ""}","${s.apellido2 ?? ""}",${s.credito},${s.estadoPulsera}`);
      const csv = [cabecera, ...filas].join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = todos ? "socios-completo.csv" : "socios-pagina.csv";
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExportando(false);
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Socios</h1>
        <div className="flex gap-2">
          <div className="relative group">
            <button
              disabled={exportando}
              className="flex items-center gap-2 px-4 py-2 border border-border rounded-lg text-sm font-medium hover:bg-muted transition-colors"
              title="Exportar CSV"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">{exportando ? "Exportando..." : "Exportar"}</span>
            </button>
            <div className="absolute right-0 top-full mt-1 bg-white border border-border rounded-xl shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10 min-w-40">
              <button
                onClick={() => exportarCSV(false)}
                className="w-full text-left px-4 py-2.5 text-sm hover:bg-muted transition-colors rounded-t-xl"
              >
                Solo esta página ({socios.length})
              </button>
              <button
                onClick={() => exportarCSV(true)}
                className="w-full text-left px-4 py-2.5 text-sm hover:bg-muted transition-colors rounded-b-xl border-t border-border"
              >
                Todos los socios
              </button>
            </div>
          </div>
          <Link
            href="/admin/socios/nuevo"
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
          >
            <Plus className="w-4 h-4" />
            Nuevo
          </Link>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nombre, apellido o nº de socio..."
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
                    <p className="font-medium truncate">
                      {socio.nombre}
                      {socio.apellido1 ? ` ${socio.apellido1}` : ""}
                      {socio.apellido2 ? ` ${socio.apellido2}` : ""}
                    </p>
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
                    onClick={() => togglePulsera(socio.id, socio.nombre, socio.estadoPulsera, socio.apellido1 ?? undefined, socio.apellido2 ?? undefined)}
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

      {totalPages > 1 && !loading && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="px-3 py-1.5 border border-border rounded-lg text-sm font-medium hover:bg-muted transition-colors disabled:opacity-30 disabled:pointer-events-none"
          >
            Anterior
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <button
              key={p}
              onClick={() => setPage(p)}
              className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
                p === page
                  ? "bg-primary text-primary-foreground"
                  : "border border-border hover:bg-muted"
              }`}
            >
              {p}
            </button>
          ))}
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="px-3 py-1.5 border border-border rounded-lg text-sm font-medium hover:bg-muted transition-colors disabled:opacity-30 disabled:pointer-events-none"
          >
            Siguiente
          </button>
        </div>
      )}
    </div>
  );
}
