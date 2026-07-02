"use client";

import { useState, useRef } from "react";
import { Upload, Download } from "lucide-react";
import Papa from "papaparse";

export default function ImportarSociosPage() {
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState<{
    creados: number;
    actualizados: number;
    omitidos: number;
    errores: string[];
  } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setResultado(null);

    try {
      const text = await file.text();
      const result = Papa.parse<Record<string, string>>(text, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (h) => h.trim().toLowerCase(),
      });

      const rows = result.data.map((r) => ({
        dni: r.dni || "",
        nombre: (r.nombre || "").trim().toUpperCase(),
        apellidos: (r.apellidos || "").trim().toUpperCase(),
        tipoVinculacion: (r.tipo_vinculacion || "").trim(),
        fechaNacimiento: r.fecha_nacimiento || null,
      }));

      const res = await fetch("/api/socios/importar-gestion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(rows),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Error en importación");
      }

      const data = await res.json();
      setResultado(data);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error al importar");
    } finally {
      setLoading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold flex items-center gap-2">
        <Upload className="w-6 h-6" /> Importar Socios
      </h1>

      <div className="bg-white border border-border rounded-xl p-6 space-y-4">
        <h2 className="font-semibold">Formato del CSV</h2>
        <p className="text-sm text-muted-foreground">
          Importa el archivo exportado de la app de gestión. Busca por DNI para
          actualizar si ya existe, o crea uno nuevo.
        </p>
        <p className="text-sm text-muted-foreground">
          Columnas requeridas:{" "}
          <code className="bg-muted px-1 rounded">dni, nombre, apellidos, tipo_vinculacion, fecha_nacimiento</code>
        </p>
        <p className="text-sm text-muted-foreground">
          El crédito se asigna automáticamente según el tipo: socio 100€,
          hijos_mayores 100€, socios_menores 50€, hijo_socio 0€.
        </p>
      </div>

      <div className="bg-white border border-border rounded-xl p-6">
        <input
          ref={fileRef}
          type="file"
          accept=".csv"
          onChange={handleFile}
          disabled={loading}
          className="block w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-primary file:text-primary-foreground hover:file:opacity-90 disabled:opacity-50"
        />
      </div>

      {loading && (
        <div className="text-center text-muted-foreground">Importando...</div>
      )}

      {resultado && (
        <div className="bg-white border border-border rounded-xl p-6 space-y-3">
          <p className="text-green-600 font-medium">
            ✓ {resultado.creados} creados, {resultado.actualizados} actualizados
          </p>
          {resultado.omitidos > 0 && (
            <p className="text-muted-foreground text-sm">{resultado.omitidos} omitidos (sin nombre)</p>
          )}
          {resultado.errores.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-red-700 font-medium text-sm">{resultado.errores.length} errores:</p>
              <ul className="list-disc list-inside text-red-600 text-xs mt-1">
                {resultado.errores.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            </div>
          )}
          <button
            onClick={() => { setResultado(null); if (fileRef.current) fileRef.current.value = ""; }}
            className="w-full py-2 border border-border rounded-lg text-sm font-medium hover:bg-muted"
          >
            Importar otro archivo
          </button>
        </div>
      )}
    </div>
  );
}
