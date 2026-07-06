"use client";

import { useState, useEffect } from "react";
import { Download, Printer } from "lucide-react";

const TIPOS_VINCULACION = [
  { value: "socio", label: "Socio" },
  { value: "socios_menores", label: "Socio menor" },
  { value: "hijos_mayores", label: "Hijo mayor" },
  { value: "hijo_socio", label: "Hijo menor" },
] as const;

interface Socio {
  id: number;
  numeroSocio: string;
  nombre: string;
  apellido1: string | null;
  apellido2: string | null;
  tipoVinculacion: string;
  credito: number;
  qrToken: string;
}

export default function QrMasivoPage() {
  const [socios, setSocios] = useState<Socio[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTipos, setSelectedTipos] = useState<Set<string>>(
    new Set(TIPOS_VINCULACION.map((t) => t.value))
  );

  useEffect(() => {
    fetch("/api/socios?limit=500&estado=activa")
      .then((r) => r.json())
      .then((data) => setSocios((data.socios ?? [])))
      .catch(() => setSocios([]))
      .finally(() => setLoading(false));
  }, []);

  const toggleTipo = (tipo: string) => {
    setSelectedTipos((prev) => {
      const next = new Set(prev);
      if (next.has(tipo)) {
        next.delete(tipo);
      } else {
        next.add(tipo);
      }
      return next;
    });
  };

  const sociosFiltrados = socios.filter((s) => selectedTipos.has(s.tipoVinculacion));

  const generatePDF = async () => {
    const { default: jsPDF } = await import("jspdf");
    const qrModule = await import("qrcode");

    const doc = new jsPDF("p", "mm", "a4");

    const pageW = 210;
    const pageH = 297;
    const margin = 10;
    const cardW = 50;
    const cardH = 30;
    const cols = 3;
    const gapX = (pageW - margin * 2 - cols * cardW) / (cols - 1);
    const gapY = 3;
    const cardsPerPage = cols * Math.floor((pageH - margin * 2) / (cardH + gapY));

    let current = 0;

    for (const socio of sociosFiltrados) {
      const pageIndex = current % cardsPerPage;
      const col = pageIndex % cols;
      const row = Math.floor(pageIndex / cols);

      if (current > 0 && pageIndex === 0) {
        doc.addPage();
      }

      const x = margin + col * (cardW + gapX);
      const y = margin + row * (cardH + gapY);

      const qrUrl = `${window.location.origin}/scanner/result?token=${socio.qrToken}`;
      const qrDataUrl = await qrModule.default.toDataURL(qrUrl, {
        width: 250,
        margin: 1,
        color: { dark: "#000000", light: "#FFFFFF" },
      });

      const qrSize = cardH - 6;
      const qrX = x + 3;
      const qrY = y + 3;
      doc.addImage(qrDataUrl, "PNG", qrX, qrY, qrSize, qrSize);

      const parts = socio.nombre.trim().split(/\s+/);
      const nombreLinea = socio.apellido1
        ? socio.nombre
        : parts.slice(0, -1).join(" ");
      const apellidoLinea = socio.apellido1 ?? (parts.length >= 2 ? parts[parts.length - 1] : "");
      const textX = qrX + qrSize + 3;
      const lineH = 4.5;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.text(`Nº ${socio.numeroSocio}`, textX, y + 7);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.text(nombreLinea, textX, y + 7 + lineH);

      if (apellidoLinea) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7);
        doc.text(apellidoLinea, textX, y + 7 + lineH * 2);
      }

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
          recortar y pegar en las pulseras. Puedes filtrar por tipo de vinculación
          para incluir solo los socios que quieras.
        </p>

        <div className="space-y-2">
          <p className="text-sm font-semibold">Filtrar por tipo de vinculación:</p>
          <div className="flex flex-wrap gap-3">
            {TIPOS_VINCULACION.map((tipo) => (
              <label
                key={tipo.value}
                className="flex items-center gap-2 text-sm cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={selectedTipos.has(tipo.value)}
                  onChange={() => toggleTipo(tipo.value)}
                  className="w-4 h-4 rounded border-border accent-primary"
                />
                {tipo.label}
              </label>
            ))}
          </div>
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">Cargando socios...</p>
        ) : (
          <div className="space-y-4">
            <p className="text-sm">
              <strong>{sociosFiltrados.length}</strong> socios seleccionados
              {sociosFiltrados.length !== socios.length && (
                <span className="text-muted-foreground">
                  {" "}
                  (de {socios.length} activos)
                </span>
              )}
            </p>

            <button
              onClick={generatePDF}
              disabled={sociosFiltrados.length === 0}
              className="flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-xl font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              <Download className="w-5 h-5" />
              Generar PDF con QRs ({sociosFiltrados.length})
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
