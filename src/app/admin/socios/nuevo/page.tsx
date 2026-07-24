"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";

export default function NuevoSocioPage() {
  const router = useRouter();
  const [nombre, setNombre] = useState("");
  const [credito, setCredito] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nuevoSocio, setNuevoSocio] = useState<{
    id: number;
    nombre: string;
    numeroSocio: string;
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
          credito: credito ? parseFloat(credito) : 0,
        }),
      });

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
    const qrUrl = `${window.location.origin}/scanner?token=${nuevoSocio.qrToken}`;
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
                const [{ default: jsPDF }, qrModule] = await Promise.all([
                  import("jspdf"),
                  import("qrcode"),
                ]);

                const qrUrl = `${window.location.origin}/scanner?token=${nuevoSocio.qrToken}`;
                const qrDataUrl = await qrModule.default.toDataURL(qrUrl, {
                  width: 200,
                  margin: 1,
                  color: { dark: "#000000", light: "#FFFFFF" },
                });

                const doc = new jsPDF("p", "mm", "a4");
                const pageW = 210;
                const pageH = 297;
                const cardW = 63.33;
                const cardH = 69.25;
                const x = (pageW - cardW) / 2;
                const y = (pageH - cardH) / 2;
                const qrSize = Math.min(cardW, cardH) - 20;
                const qrX = x + (cardW - qrSize) / 2;
                const qrY = y + 5;

                doc.addImage(qrDataUrl, "PNG", qrX, qrY, qrSize, qrSize);
                doc.setFontSize(7);
                doc.text(
                  `${nuevoSocio.nombre} (#${nuevoSocio.numeroSocio})`,
                  x + cardW / 2,
                  y + cardH - 3,
                  { align: "center" }
                );

                doc.save(`qr-${nuevoSocio.numeroSocio}.pdf`);
              }}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90"
            >
              Descargar QR
            </button>
            <button
              onClick={() => {
                setNuevoSocio(null);
                setNombre("");
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
