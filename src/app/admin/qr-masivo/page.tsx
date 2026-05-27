"use client";

import { useState, useEffect } from "react";
import { Download, Printer } from "lucide-react";

interface Socio {
  id: number;
  numeroSocio: number;
  nombre: string;
  qrToken: string;
}

export default function QrMasivoPage() {
  const [socios, setSocios] = useState<Socio[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/socios?limit=500")
      .then((r) => r.json())
      .then((data) => setSocios(data.socios ?? []))
      .catch(() => setSocios([]))
      .finally(() => setLoading(false));
  }, []);

  const generatePDF = async () => {
    const { default: jsPDF } = await import("jspdf");

    const doc = new jsPDF("p", "mm", "a4");
    const pageW = 210;
    const pageH = 297;
    const margin = 10;
    const cols = 3;
    const rows = 4;
    const cardW = (pageW - margin * 2) / cols;
    const cardH = (pageH - margin * 2) / rows;

    let current = 0;

    for (const socio of socios) {
      const col = current % cols;
      const row = Math.floor(current / cols) % rows;

      if (current > 0 && current % (cols * rows) === 0) {
        doc.addPage();
      }

      const x = margin + col * cardW;
      const y = margin + row * cardH;

      const qrUrl = `${window.location.origin}/scanner?token=${socio.qrToken}`;

      // Generate QR as canvas data URL
      const qrModule = await import("qrcode");
      const qrDataUrl = await qrModule.default.toDataURL(qrUrl, {
        width: 200,
        margin: 1,
        color: { dark: "#000000", light: "#FFFFFF" },
      });

      const qrSize = Math.min(cardW, cardH) - 20;
      const qrX = x + (cardW - qrSize) / 2;
      const qrY = y + 5;

      doc.addImage(qrDataUrl, "PNG", qrX, qrY, qrSize, qrSize);

      doc.setFontSize(7);
      doc.text(
        `${socio.nombre} (#${socio.numeroSocio})`,
        x + cardW / 2,
        y + cardH - 3,
        { align: "center" }
      );

      current++;
    }

    doc.save("pulseras-qr.pdf");
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <h1 className="text-2xl font-bold flex items-center gap-2">
        <Printer className="w-6 h-6" /> Generar QR Masivo
      </h1>

      <div className="bg-white border border-border rounded-xl p-6 space-y-4">
        <p className="text-muted-foreground">
          Genera un PDF con todos los códigos QR para imprimir y colocar en las
          pulseras. Cada página contiene {12} QRs organizados en 3 columnas y 4 filas.
        </p>

        {loading ? (
          <p className="text-sm text-muted-foreground">
            Cargando socios...
          </p>
        ) : (
          <div className="space-y-4">
            <p className="text-sm">
              <strong>{socios.length}</strong> socios encontrados
            </p>

            <button
              onClick={generatePDF}
              className="flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-xl font-semibold hover:opacity-90 transition-opacity"
            >
              <Download className="w-5 h-5" />
              Generar PDF con QRs
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
