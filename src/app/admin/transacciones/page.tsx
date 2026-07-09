"use client";

import { useState, useEffect } from "react";
import { formatEuro } from "@/lib/utils";
import { ArrowUpDown, Download, Search } from "lucide-react";

interface Transaccion {
  id: number;
  socioId: number;
  tipo: string;
  cantidad: number;
  descripcion: string | null;
  createdAt: string;
  socio: { nombre: string; numeroSocio: string };
  puntoVenta: { nombre: string } | null;
}

export default function TransaccionesPage() {
  const [transacciones, setTransacciones] = useState<Transaccion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filtroNombre, setFiltroNombre] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("");

  useEffect(() => {
    fetch("/api/transacciones")
      .then(async (r) => {
        if (r.status === 401) { window.location.href = "/admin/login"; return; }
        if (!r.ok) throw new Error("Error al cargar transacciones");
        return r.json();
      })
      .then((data) => { if (data) setTransacciones(data); })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const filtrarTransacciones = (t: Transaccion) => {
    const nombreOk = !filtroNombre || t.socio.nombre.toLowerCase().includes(filtroNombre.toLowerCase());
    const tipoOk = !filtroTipo || t.tipo === filtroTipo;
    return nombreOk && tipoOk;
  };

  const filtradas = transacciones.filter(filtrarTransacciones);

  const exportarCSV = (lista: Transaccion[]) => {
    const cabecera = "Nº Socio,Socio,Tipo,Cantidad,Concepto,Punto,Fecha";
    const filas = lista.map((t) =>
      `${t.socio.numeroSocio},"${t.socio.nombre}",${t.tipo},${t.cantidad},"${t.descripcion ?? ""}","${t.puntoVenta?.nombre ?? ""}",${new Date(t.createdAt).toISOString()}`
    );
    const csv = [cabecera, ...filas].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "transacciones.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-4 md:p-6 space-y-4">
      <h1 className="text-2xl font-bold flex items-center gap-2">
        <ArrowUpDown className="w-6 h-6" /> Transacciones
      </h1>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={filtroNombre}
            onChange={(e) => setFiltroNombre(e.target.value)}
            placeholder="Buscar por socio..."
            className="w-full pl-10 pr-4 py-2.5 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
          />
        </div>
        <select
          value={filtroTipo}
          onChange={(e) => setFiltroTipo(e.target.value)}
          className="px-4 py-2.5 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 transition-colors bg-white"
        >
          <option value="">Todos los tipos</option>
          <option value="carga">Solo cargas</option>
          <option value="consumo">Solo consumos</option>
        </select>
        <button
          onClick={() => exportarCSV(filtradas)}
          className="flex items-center gap-2 px-4 py-2.5 border border-border rounded-xl text-sm font-medium hover:bg-muted transition-colors whitespace-nowrap"
        >
          <Download className="w-4 h-4" />
          <span className="hidden sm:inline">Exportar CSV</span>
        </button>
      </div>

      <div className="bg-white border border-border rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-muted-foreground">Cargando...</div>
        ) : error ? (
          <div className="p-8 text-center text-red-600">{error}</div>
        ) : filtradas.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            {filtroNombre || filtroTipo ? "No hay transacciones que coincidan con los filtros" : "No hay transacciones"}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="text-left px-4 py-3 font-medium">Socio</th>
                  <th className="text-left px-4 py-3 font-medium">Tipo</th>
                  <th className="text-left px-4 py-3 font-medium">Concepto</th>
                  <th className="text-left px-4 py-3 font-medium">Punto</th>
                  <th className="text-right px-4 py-3 font-medium">Cantidad</th>
                  <th className="text-right px-4 py-3 font-medium">Fecha</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtradas.map((t) => (
                  <tr key={t.id} className="hover:bg-muted/50">
                    <td className="px-4 py-3">
                      {t.socio.nombre}
                      <span className="text-muted-foreground ml-1">
                        #{t.socio.numeroSocio}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          t.tipo === "carga"
                            ? "bg-green-100 text-green-700"
                            : "bg-red-100 text-red-700"
                        }`}
                      >
                        {t.tipo === "carga" ? "Carga" : "Consumo"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {t.descripcion ?? "-"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {t.puntoVenta?.nombre ?? "-"}
                    </td>
                    <td
                      className={`px-4 py-3 text-right font-medium ${
                        t.tipo === "carga" ? "text-green-600" : "text-red-600"
                      }`}
                    >
                      {t.tipo === "carga" ? "+" : "-"}
                      {formatEuro(t.cantidad)}
                    </td>
                    <td className="px-4 py-3 text-right text-muted-foreground">
                      {new Date(t.createdAt).toLocaleString("es-ES")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
