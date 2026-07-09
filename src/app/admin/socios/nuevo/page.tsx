"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import {
  TipoFormato,
  generarEtiquetaPNG,
  getNombreArchivo,
} from "@/lib/generar-con-formato";

export default function NuevoSocioPage() {
  const router = useRouter();
  const [nombre, setNombre] = useState("");
  const [apellido1, setApellido1] = useState("");
  const [apellido2, setApellido2] = useState("");
  const [tipo, setTipo] = useState("socio");
  const [fechaNac, setFechaNac] = useState("");
  const [credito, setCredito] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nuevoSocio, setNuevoSocio] = useState<{
    id: number;
    nombre: string;
    numeroSocio: string;
    apellido1: string | null;
    apellido2: string | null;
    qrToken: string;
  } | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/socios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre,
          apellido1: apellido1 || undefined,
          apellido2: apellido2 || undefined,
          tipoVinculacion: tipo,
          fechaNacimiento: fechaNac ? new Date(fechaNac).toISOString() : null,
          credito: credito ? parseFloat(credito) : 0,
        }),
      });

      if (res.status === 401) { window.location.href = "/admin/login"; return; }
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Error al crear socio");
      }

      const socio = await res.json();
      setNuevoSocio(socio);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al crear socio");
    } finally {
      setLoading(false);
    }
  };

  if (nuevoSocio) {
    const qrUrl = `${window.location.origin}/scanner/result?token=${nuevoSocio.qrToken}`;
    return (
      <div className="p-4 md:p-6 space-y-6">
        <h1 className="text-2xl font-bold">Socio Creado</h1>
        <div className="bg-white border border-border rounded-xl p-6 text-center space-y-4">
          <h2 className="text-xl font-semibold">{nuevoSocio.nombre}</h2>
          <p className="text-muted-foreground">{nuevoSocio.numeroSocio}</p>
          <div className="inline-block p-4 bg-white rounded-xl border border-border">
            <QRCodeSVG value={qrUrl} size={200} />
          </div>
          <p className="text-xs text-muted-foreground break-all">{qrUrl}</p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={async () => {
                const url = await generarEtiquetaPNG("llaveros", nuevoSocio);
                const a = document.createElement("a");
                a.href = url;
                a.download = getNombreArchivo("llaveros", nuevoSocio.numeroSocio);
                a.click();
              }}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90"
            >
              Llavero
            </button>
            <button
              onClick={async () => {
                const url = await generarEtiquetaPNG("pulseras", nuevoSocio);
                const a = document.createElement("a");
                a.href = url;
                a.download = getNombreArchivo("pulseras", nuevoSocio.numeroSocio);
                a.click();
              }}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90"
            >
              Pulsera
            </button>
            <button
              onClick={() => {
                setNuevoSocio(null);
                setNombre("");
                setApellido1("");
                setApellido2("");
                setTipo("socio");
                setFechaNac("");
                setCredito("");
              }}
              className="px-4 py-2 border border-border rounded-lg text-sm font-medium hover:bg-muted"
            >
              Otro Socio
            </button>
            <button
              onClick={() => router.push("/admin/socios")}
              className="px-4 py-2 border border-border rounded-lg text-sm font-medium hover:bg-muted"
            >
              Volver
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-md space-y-6">
      <h1 className="text-2xl font-bold">Nuevo Socio</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Nombre</label>
          <input
            type="text"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            className="w-full px-4 py-2.5 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Primer apellido</label>
          <input
            type="text"
            value={apellido1}
            onChange={(e) => setApellido1(e.target.value)}
            className="w-full px-4 py-2.5 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Segundo apellido <span className="text-muted-foreground">(opcional)</span></label>
          <input
            type="text"
            value={apellido2}
            onChange={(e) => setApellido2(e.target.value)}
            className="w-full px-4 py-2.5 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Tipo de vinculación</label>
          <select
            value={tipo}
            onChange={(e) => setTipo(e.target.value)}
            className="w-full px-4 py-2.5 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option value="socio">Socio</option>
            <option value="hijos_mayores">Hijo mayor</option>
            <option value="socios_menores">Socio menor</option>
            <option value="hijo_socio">Hijo menor</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Fecha de nacimiento <span className="text-muted-foreground">(opcional)</span></label>
          <input
            type="date"
            value={fechaNac}
            onChange={(e) => setFechaNac(e.target.value)}
            className="w-full px-4 py-2.5 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            Crédito inicial (€)
          </label>
          <input
            type="number"
            step="0.01"
            value={credito}
            onChange={(e) => setCredito(e.target.value)}
            className="w-full px-4 py-2.5 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          />
        </div>

        {error && <p className="text-destructive text-sm">{error}</p>}

        <button
          type="submit"
          disabled={loading || !nombre}
          className="w-full py-3 bg-primary text-primary-foreground rounded-xl font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {loading ? "Creando..." : "Crear Socio"}
        </button>
      </form>
    </div>
  );
}
