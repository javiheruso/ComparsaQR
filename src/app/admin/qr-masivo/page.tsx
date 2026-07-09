"use client";

import { useState, useEffect } from "react";
import { Download, FileSpreadsheet, Printer } from "lucide-react";
import {
  TipoFormato,
  getSociosPorPagina,
  getNombreArchivo,
  generarPaginaPDF,
} from "@/lib/generar-con-formato";

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
  filada: string | null;
}

export default function QrMasivoPage() {
  const [socios, setSocios] = useState<Socio[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [generatingUrls, setGeneratingUrls] = useState(false);
  const [formato, setFormato] = useState<TipoFormato>("pulseras");
  const [selectedTipos, setSelectedTipos] = useState<Set<string>>(
    new Set(TIPOS_VINCULACION.map((t) => t.value))
  );

  useEffect(() => {
    fetch("/api/socios?limit=500&estado=activa")
      .then((r) => {
        if (r.status === 401) { window.location.href = "/admin/login"; return; }
        return r.json();
      })
      .then((data) => { if (data) setSocios(data.socios ?? []); })
      .catch(() => setSocios([]))
      .finally(() => setLoading(false));
  }, []);

  const toggleTipo = (tipo: string) => {
    setSelectedTipos((prev) => {
      const next = new Set(prev);
      if (next.has(tipo)) next.delete(tipo);
      else next.add(tipo);
      return next;
    });
  };

  const sociosFiltrados = socios
    .filter((s) => selectedTipos.has(s.tipoVinculacion))
    .sort((a, b) => {
      if (a.filada == null && b.filada == null) return 0;
      if (a.filada == null) return 1;
      if (b.filada == null) return -1;
      return a.filada.localeCompare(b.filada);
    });

  const generatePDF = async () => {
    setGenerating(true);
    try {
      const { default: jsPDF } = await import("jspdf");
      const qrModule = await import("qrcode");
      const doc = new jsPDF("p", "mm", "a4");

      const cardsPerPage = getSociosPorPagina(formato);

      // Agrupar por filada para insertar saltos de página entre grupos
      const grupos: Socio[][] = [];
      let grupoActual: Socio[] = [];
      let filadaActual: string | null = null;

      for (const socio of sociosFiltrados) {
        if (socio.filada !== filadaActual && grupoActual.length > 0) {
          grupos.push(grupoActual);
          grupoActual = [];
        }
        filadaActual = socio.filada;
        grupoActual.push(socio);
      }
      if (grupoActual.length > 0) grupos.push(grupoActual);

      let primeraPagina = true;
      for (const grupo of grupos) {
        for (let i = 0; i < grupo.length; i += cardsPerPage) {
          if (!primeraPagina) doc.addPage();
          primeraPagina = false;
          await generarPaginaPDF(doc, formato, grupo, i, qrModule);
        }
      }

      doc.save(getNombreArchivo(formato));
    } catch (err) {
      console.error("Error generando PDF:", err);
    } finally {
      setGenerating(false);
    }
  };

  const generateXLSX = async () => {
    setGeneratingUrls(true);
    try {
      const XLSX = await import("xlsx");
      const data = sociosFiltrados.map((s) => ({
        nombre: [s.nombre, s.apellido1, s.apellido2]
          .filter(Boolean)
          .join(" "),
        url_qr: `${window.location.origin}/scanner/result?token=${s.qrToken}`,
        numero_socio: s.numeroSocio,
      }));

      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Socios");
      XLSX.writeFile(wb, "urls-qr.xlsx");
    } finally {
      setGeneratingUrls(false);
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <h1 className="text-2xl font-bold flex items-center gap-2">
        <Printer className="w-6 h-6" /> Generar QR para Pulseras
      </h1>

      <div className="bg-white border border-border rounded-xl p-6 space-y-4">
        <p className="text-muted-foreground">
          Genera un PDF con las plantillas de{" "}
          <strong>
            {formato === "llaveros" ? "llaveros" : "pulseras"}
          </strong>{" "}
          listas para imprimir y recortar.
        </p>

        <div className="space-y-2">
          <p className="text-sm font-semibold">Formato de etiqueta:</p>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="radio"
                name="formato"
                value="pulseras"
                checked={formato === "pulseras"}
                onChange={() => setFormato("pulseras")}
                className="w-4 h-4 accent-primary"
              />
              Pulseras (50×19mm, 39 uds.)
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="radio"
                name="formato"
                value="llaveros"
                checked={formato === "llaveros"}
                onChange={() => setFormato("llaveros")}
                className="w-4 h-4 accent-primary"
              />
              Llaveros (60×30mm, 24 uds.)
            </label>
          </div>
        </div>

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

            <div className="flex flex-wrap gap-3">
              <button
                onClick={generatePDF}
                disabled={sociosFiltrados.length === 0 || generating}
                className="flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-xl font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                <Download className="w-5 h-5" />
                {generating
                  ? "Generando..."
                  : `Generar PDF (${sociosFiltrados.length})`}
              </button>
              <button
                onClick={generateXLSX}
                disabled={sociosFiltrados.length === 0 || generatingUrls}
                className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                <FileSpreadsheet className="w-5 h-5" />
                {generatingUrls
                  ? "Generando..."
                  : `Generar URLs (${sociosFiltrados.length})`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
