"use client";

import { useState } from "react";
import { Wallet, ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";

const TIPOS = [
  { value: "socio", label: "Socios" },
  { value: "hijos_mayores", label: "Hijos mayores" },
  { value: "socios_menores", label: "Socios menores" },
  { value: "hijo_socio", label: "Hijos de socio" },
];

export default function RecargarPage() {
  const router = useRouter();
  const [tipo, setTipo] = useState("socio");
  const [cantidad, setCantidad] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [cargando, setCargando] = useState(false);
  const [resultado, setResultado] = useState<{ procesados: number; cantidad: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const recargar = async () => {
    const importe = parseFloat(cantidad);
    if (isNaN(importe) || importe <= 0) return;
    setCargando(true);
    setError(null);

    try {
      const res = await fetch("/api/socios/recargar-masivo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipoVinculacion: tipo,
          cantidad: importe,
          descripcion: descripcion || undefined,
        }),
      });

      if (res.status === 401) { window.location.href = "/admin/login"; return; }
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Error al recargar");
      }

      const data = await res.json();
      setResultado(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-lg">
      <button
        onClick={() => router.back()}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="w-4 h-4" /> Volver
      </button>

      <h1 className="text-2xl font-bold flex items-center gap-2">
        <Wallet className="w-6 h-6" /> Recarga Masiva
      </h1>

      <div className="bg-white border border-border rounded-xl p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Tipo de socio</label>
          <select
            value={tipo}
            onChange={(e) => setTipo(e.target.value)}
            className="w-full px-4 py-2.5 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            {TIPOS.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Cantidad (€)</label>
          <input
            type="number"
            step="0.01"
            min="0.01"
            value={cantidad}
            onChange={(e) => setCantidad(e.target.value)}
            placeholder="100"
            className="w-full px-4 py-2.5 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Concepto <span className="text-muted-foreground font-normal">(opcional)</span></label>
          <input
            type="text"
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            placeholder="Derrama 2025"
            className="w-full px-4 py-2.5 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>

        {error && <p className="text-destructive text-sm">{error}</p>}

        {resultado ? (
          <div className="space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
              <p className="text-green-700 font-semibold text-lg">
                {resultado.procesados} socios recargados
              </p>
              <p className="text-green-600 text-sm">
                {resultado.cantidad}€ cada uno
              </p>
            </div>
            <button
              onClick={() => { setResultado(null); setCantidad(""); setDescripcion(""); }}
              className="w-full py-2.5 border border-border rounded-xl text-sm font-medium hover:bg-muted"
            >
              Otra recarga
            </button>
          </div>
        ) : (
          <button
            onClick={recargar}
            disabled={cargando || !cantidad}
            className="w-full py-3 bg-primary text-primary-foreground rounded-xl font-semibold hover:opacity-90 disabled:opacity-50"
          >
            {cargando ? "Recargando..." : "Recargar"}
          </button>
        )}
      </div>
    </div>
  );
}
