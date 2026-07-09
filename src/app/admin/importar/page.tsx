"use client";

import { useState, useRef } from "react";
import { Upload, RefreshCw } from "lucide-react";
import Papa from "papaparse";

export default function ImportarSociosPage() {
  const [loading, setLoading] = useState(false);
  const [syncLoading, setSyncLoading] = useState(false);
  const [resultado, setResultado] = useState<{
    creados: number;
    actualizados: number;
    omitidos: number;
    errores: string[];
  } | null>(null);
  const [syncResultado, setSyncResultado] = useState<{
    creados: number;
    actualizados: number;
    desactivados: number;
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
        numeroSocio: (r.numero_socio || "").trim(),
        dni: r.dni || "",
        nombre: (r.nombre || "").trim().toUpperCase(),
        apellidos: (r.apellidos || "").trim().toUpperCase(),
        tipoVinculacion: (r.tipo_vinculacion || "").trim(),
        fechaNacimiento: r.fecha_nacimiento || null,
        activo: (r.activo || "").trim(),
      }));

      const res = await fetch("/api/socios/importar-gestion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(rows),
      });

      if (res.status === 401) { window.location.href = "/admin/login"; return; }
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

  const handleSync = async () => {
    if (!confirm("¿Sincronizar con la app de gestión? Se actualizarán los datos de todos los socios.")) return;
    setSyncLoading(true);
    setSyncResultado(null);
    try {
      const res = await fetch("/api/sync-from-gestion", { method: "POST" });
      if (res.status === 401) { window.location.href = "/admin/login"; return; }
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Error en sincronización");
      }
      const data = await res.json();
      setSyncResultado(data);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error al sincronizar");
    } finally {
      setSyncLoading(false);
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
          Importa el archivo exportado de la app de gestión. Busca primero por
          numero_socio y luego por DNI.
        </p>
        <p className="text-sm text-muted-foreground">
          Columnas:{" "}
          <code className="bg-muted px-1 rounded">numero_socio, dni, nombre, apellidos, tipo_vinculacion, fecha_nacimiento, activo</code>
        </p>
        <p className="text-sm text-muted-foreground">
          El crédito se asigna según el tipo: socio 100€,
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

      <div className="bg-white border border-border rounded-xl p-6 space-y-4">
        <h2 className="font-semibold flex items-center gap-2">
          <RefreshCw className="w-5 h-5" /> Sincronización directa
        </h2>
        <p className="text-sm text-muted-foreground">
          Conecta directamente con la base de datos de la app de gestión para
          importar todos los socios. Los nuevos se crean, los existentes se
          actualizan, y los que ya no están en gestión se desactivan (sin
          crédito pendiente).
        </p>
        <button
          onClick={handleSync}
          disabled={syncLoading}
          className="flex items-center gap-2 w-full justify-center py-3 bg-primary text-primary-foreground rounded-xl font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          <RefreshCw className={`w-5 h-5 ${syncLoading ? "animate-spin" : ""}`} />
          {syncLoading ? "Sincronizando..." : "Sincronizar con gestión"}
        </button>

        {syncResultado && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 space-y-2">
            <p className="text-green-700 font-medium">✓ Sincronización completada</p>
            <p className="text-sm text-green-600">
              {syncResultado.creados} creados, {syncResultado.actualizados} actualizados, {syncResultado.desactivados} desactivados
            </p>
            {syncResultado.errores.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 mt-2">
                <p className="text-red-700 font-medium text-sm">{syncResultado.errores.length} errores:</p>
                <ul className="list-disc list-inside text-red-600 text-xs mt-1">
                  {syncResultado.errores.map((e, i) => (
                    <li key={i}>{e}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
