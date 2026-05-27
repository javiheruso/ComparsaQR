"use client";

import { useState, useEffect } from "react";
import { formatEuro } from "@/lib/utils";
import { ArrowUpDown } from "lucide-react";

interface Transaccion {
  id: number;
  socioId: number;
  tipo: string;
  cantidad: number;
  descripcion: string | null;
  createdAt: string;
  socio: { nombre: string; numeroSocio: string };
}

export default function TransaccionesPage() {
  const [transacciones, setTransacciones] = useState<Transaccion[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/transacciones")
      .then((r) => r.json())
      .then(setTransacciones)
      .catch(() => setTransacciones([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-4 md:p-6 space-y-4">
      <h1 className="text-2xl font-bold flex items-center gap-2">
        <ArrowUpDown className="w-6 h-6" /> Transacciones
      </h1>

      <div className="bg-white border border-border rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-muted-foreground">Cargando...</div>
        ) : transacciones.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            No hay transacciones
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="text-left px-4 py-3 font-medium">Socio</th>
                  <th className="text-left px-4 py-3 font-medium">Tipo</th>
                  <th className="text-left px-4 py-3 font-medium">Concepto</th>
                  <th className="text-right px-4 py-3 font-medium">Cantidad</th>
                  <th className="text-right px-4 py-3 font-medium">Fecha</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {transacciones.map((t) => (
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
