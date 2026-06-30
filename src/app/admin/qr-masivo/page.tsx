"use client";

import { useState, useEffect } from "react";
import { Download, Printer } from "lucide-react";

interface Socio {
  id: number;
  numeroSocio: string;
  nombre: string;
  apellido1: string | null;
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
    const qrModule = await import("qrcode");

    const doc = new jsPDF("p", "mm", "a4");

    // ─── Medidas ──────────────────────────────────────
    const pageW = 210; // A4 ancho
    const pageH = 297; // A4 alto
    const margin = 10; // mm
    const cardW = 50;  // 5 cm
    const cardH = 30;  // 3 cm
    const cols = 3;
    const gapX = (pageW - margin * 2 - cols * cardW) / (cols - 1); // espacio entre columnas
    const gapY = 3; // espacio entre filas
    const cardsPerPage = cols * Math.floor((pageH - margin * 2) / (cardH + gapY));

    let current = 0;

    for (const socio of socios) {
      const pageIndex = current % cardsPerPage;
      const col = pageIndex % cols;
      const row = Math.floor(pageIndex / cols);

      // Nueva página cuando toca
      if (current > 0 && pageIndex === 0) {
        doc.addPage();
      }

      const x = margin + col * (cardW + gapX);
      const y = margin + row * (cardH + gapY);

      // ─── Generar QR ─────────────────────────────────
      const qrUrl = `${window.location.origin}/scanner/result?token=${socio.qrToken}`;
      const qrDataUrl = await qrModule.default.toDataURL(qrUrl, {
        width: 250,
        margin: 1,
        color: { dark: "#000000", light: "#FFFFFF" },
      });

      // ─── QR en la izquierda ─────────────────────────
      const qrSize = cardH - 6; // 24mm, casi todo el alto de la etiqueta
      const qrX = x + 3;        // margen interior 3mm
      const qrY = y + 3;
      doc.addImage(qrDataUrl, "PNG", qrX, qrY, qrSize, qrSize);

      // ─── Datos a la derecha del QR ──────────────────
      const apellido = socio.apellido1 ?? "";
      const textX = qrX + qrSize + 3; // 3mm de separación
      const lineH = 4.5; // altura de línea en mm

      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.text(`Nº ${socio.numeroSocio}`, textX, y + 7);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.text(socio.nombre, textX, y + 7 + lineH);

      if (apellido) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7);
        doc.text(apellido, textX, y + 7 + lineH * 2);
      }

      // ─── Borde sutil de recorte ─────────────────────
      doc.setDrawColor(200, 200, 200);
      doc.setLineWidth(0.1);
      doc.rect(x, y, cardW, cardH);

      current++;
    }

    doc.save("pulseras-qr.pdf");
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <h1 className="text-2xl font-bold flex items-center gap-2">
        <Printer className="w-6 h-6" /> Generar QR para Pulseras
      </h1>

      <div className="bg-white border border-border rounded-xl p-6 space-y-4">
        <p className="text-muted-foreground">
          Genera un PDF con etiquetas de <strong>5×3 cm</strong> listas para
          recortar y pegar en las pulseras. Cada etiqueta incluye QR + Nº de
          socio, nombre y primer apellido. Se imprimen{" "}
          <strong>{3} columnas</strong> por página con marca de corte.
        </p>

        {loading ? (
          <p className="text-sm text-muted-foreground">Cargando socios...</p>
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
