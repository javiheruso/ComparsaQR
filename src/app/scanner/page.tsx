"use client";

import { useState, useRef, useEffect } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { useRouter } from "next/navigation";

export default function ScannerPage() {
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const router = useRouter();

  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
      }
    };
  }, []);

  const startScanner = async () => {
    setError(null);
    setScanning(true);

    try {
      const scanner = new Html5Qrcode("scanner-element");
      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          scanner.stop().catch(() => {});
          setScanning(false);
          router.push(`/scanner/result?token=${encodeURIComponent(decodedText)}`);
        },
        () => {}
      );
    } catch (err) {
      setError("No se pudo acceder a la cámara. Permite el acceso e intenta de nuevo.");
      setScanning(false);
    }
  };

  const stopScanner = async () => {
    if (scannerRef.current) {
      await scannerRef.current.stop().catch(() => {});
      scannerRef.current = null;
    }
    setScanning(false);
  };

  return (
    <main className="flex-1 flex flex-col">
      <div className="bg-white border-b border-border px-4 py-3 flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="text-muted-foreground hover:text-foreground"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5" /><path d="M12 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-lg font-semibold">Escanear Pulsera</h1>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-6">
        {!scanning ? (
          <div className="text-center space-y-6">
            <div className="w-24 h-24 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
                <path d="M3 7V5a2 2 0 012-2h2" /><path d="M17 3h2a2 2 0 012 2v2" /><path d="M21 17v2a2 2 0 01-2 2h-2" /><path d="M7 21H5a2 2 0 01-2-2v-2" /><rect x="7" y="7" width="10" height="10" rx="2" />
              </svg>
            </div>
            <p className="text-muted-foreground">
              Escanea el código QR de la pulsera del socio
            </p>
            <button
              onClick={startScanner}
              className="py-3 px-8 bg-primary text-primary-foreground rounded-xl text-lg font-semibold hover:opacity-90 transition-opacity"
            >
              Activar Cámara
            </button>
            {error && (
              <p className="text-destructive text-sm">{error}</p>
            )}
          </div>
        ) : (
          <div className="w-full max-w-sm space-y-4">
            <div id="scanner-element" className="w-full aspect-square rounded-xl overflow-hidden bg-black" />
            <button
              onClick={stopScanner}
              className="w-full py-3 px-6 border border-destructive text-destructive rounded-xl font-medium hover:bg-destructive/5 transition-colors"
            >
              Detener Escáner
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
