"use client";

import { useState, useRef } from "react";
import { Upload, Download } from "lucide-react";
import Papa from "papaparse";

interface CsvRow {
  nombre: string;
  credito_inicial: string;
}

interface DetalleImport {
  nombre: string;
  accion: "creado" | "actualizado";
}

interface ResultadoImport {
  creados: number;
  actualizados: number;
  errores: { nombre: string; error: string }[];
  detalles: DetalleImport[];
}

export default function ImportarPage() {
  const [data, setData] = useState<CsvRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState<ResultadoImport | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const text = await file.text();
    const result = Papa.parse<CsvRow>(text, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim().toLowerCase(),
    });

    if (result.errors.length > 0) {
      console.error("CSV errors:", result.errors);
    }
    if (result.data.length === 0) {
      alert("El archivo debe tener una cabecera y al menos una fila");
      return;
    }

    setData(result.data);
  };

  const importar = async () => {
    setLoading(true);
    setResultado(null);

    const socios = data.map((row) => ({
      nombre: row.nombre.trim(),
      ...(row.credito_inicial
        ? { credito: parseFloat(row.credito_inicial) }
        : {}),
    }));

    try {
      const res = await fetch("/api/socios/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ socios }),
      });

      if (!res.ok) {
        const err = await res.json();
        setResultado({
          creados: 0,
          actualizados: 0,
          errores: [{ nombre: "Batch", error: err.error || "Error en la importación" }],
          detalles: [],
        });
      } else {
        const result: ResultadoImport = await res.json();
        setResultado(result);
      }
    } catch {
      setResultado({
        creados: 0,
        actualizados: 0,
        errores: [{ nombre: "Batch", error: "Error de conexión" }],
        detalles: [],
      });
    }

    setLoading(false);
  };

  const resetForm = () => {
    setData([]);
    setResultado(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold flex items-center gap-2">
        <Upload className="w-6 h-6" /> Importar Socios
      </h1>

      <div className="bg-white border border-border rounded-xl p-6 space-y-4">
        <h2 className="font-semibold">Formato del CSV</h2>
        <p className="text-sm text-muted-foreground">
          El archivo debe tener una cabecera con las columnas:{" "}
          <code className="bg-muted px-1 rounded">nombre, credito_inicial</code>
        </p>
        <p className="text-sm text-muted-foreground">
          <code>credito_inicial</code> es opcional (por defecto 0).
          Si el nombre ya existe, el socio se marca como actualizado y no se modifica su crédito.
        </p>
        <button
          onClick={() => {
            const csv = "nombre,credito_inicial\nEjemplo Socio,10\n";
            const blob = new Blob([csv], { type: "text/csv" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = "plantilla_socios.csv";
            a.click();
          }}
          className="flex items-center gap-2 px-4 py-2 border border-border rounded-lg text-sm font-medium hover:bg-muted transition-colors w-fit"
        >
          <Download className="w-4 h-4" /> Descargar Plantilla
        </button>
      </div>

      <div className="bg-white border border-border rounded-xl p-6">
        <input
          ref={fileRef}
          type="file"
          accept=".csv"
          onChange={handleFile}
          className="block w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-primary file:text-primary-foreground hover:file:opacity-90"
        />
      </div>

      {data.length > 0 && (
        <div className="bg-white border border-border rounded-xl p-6 space-y-4">
          <h2 className="font-semibold">
            Vista Previa ({data.length} socios)
          </h2>
          <div className="max-h-48 overflow-y-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-3 py-2">Nombre</th>
                  <th className="text-right px-3 py-2">Crédito Inicial</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.slice(0, 20).map((row, i) => (
                  <tr key={i}>
                    <td className="px-3 py-2">{row.nombre}</td>
                    <td className="px-3 py-2 text-right">
                      {row.credito_inicial || "0"}€
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {!resultado ? (
            <button
              onClick={importar}
              disabled={loading}
              className="w-full py-3 bg-primary text-primary-foreground rounded-xl font-semibold hover:opacity-90 disabled:opacity-50"
            >
              {loading
                ? "Importando..."
                : `Importar ${data.length} Socios`}
            </button>
          ) : (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-3">
                {resultado.creados > 0 && (
                  <p className="text-green-600 font-medium flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-green-500" />
                    {resultado.creados} socio{resultado.creados !== 1 ? "s" : ""} nuevo{resultado.creados !== 1 ? "s" : ""} creado{resultado.creados !== 1 ? "s" : ""}
                  </p>
                )}
                {resultado.actualizados > 0 && (
                  <p className="text-blue-600 font-medium flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-blue-500" />
                    {resultado.actualizados} socio{resultado.actualizados !== 1 ? "s" : ""} actualizado{resultado.actualizados !== 1 ? "s" : ""} (ya existían)
                  </p>
                )}
                {resultado.errores.length > 0 && (
                  <p className="text-red-600 font-medium flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-red-500" />
                    {resultado.errores.length} error{resultado.errores.length !== 1 ? "es" : ""}
                  </p>
                )}
              </div>

              {resultado.detalles.length > 0 && (
                <div className="max-h-48 overflow-y-auto border border-border rounded-lg">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/50">
                        <th className="text-left px-3 py-2">Nombre</th>
                        <th className="text-left px-3 py-2">Acción</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {resultado.detalles.map((d, i) => (
                        <tr key={i}>
                          <td className="px-3 py-2">{d.nombre}</td>
                          <td className="px-3 py-2">
                            {d.accion === "creado" ? (
                              <span className="text-green-600 font-medium">Creado</span>
                            ) : (
                              <span className="text-blue-600 font-medium">Actualizado</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {resultado.errores.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <p className="text-red-700 font-medium text-sm mb-1">
                    {resultado.errores.length} error{resultado.errores.length !== 1 ? "es" : ""}:
                  </p>
                  <ul className="list-disc list-inside text-red-600 text-xs">
                    {resultado.errores.slice(0, 10).map((e, i) => (
                      <li key={i}>
                        {e.nombre}: {e.error}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <button
                onClick={resetForm}
                className="w-full py-2 border border-border rounded-lg text-sm font-medium hover:bg-muted"
              >
                Importar Otro Archivo
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
