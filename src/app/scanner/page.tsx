"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { useRouter, useSearchParams } from "next/navigation";
import { extractQrToken } from "@/lib/qr";
import { ScannerAccessGate } from "./ScannerAccessGate";

interface CameraDevice {
  id: string;
  label: string;
}

const LAST_CAMERA_KEY = "comparsa_scanner_camera_id";

function waitForScannerElement(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => resolve());
  });
}

function getPreferredCamera(cameras: CameraDevice[]): string {
  const storedCameraId = window.localStorage.getItem(LAST_CAMERA_KEY);
  const storedCamera = cameras.find((camera) => camera.id === storedCameraId);

  if (storedCamera) return storedCamera.id;

  const backCamera = cameras.find((camera) =>
    /back|rear|environment|trasera|posterior|espalda/i.test(camera.label)
  );

  return backCamera?.id ?? cameras[0]?.id ?? "";
}

function ScannerContent() {
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cameras, setCameras] = useState<CameraDevice[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState("");
  const [activeCameraId, setActiveCameraId] = useState("");
  const [loadingCameras, setLoadingCameras] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const isRunningRef = useRef(false);
  const hasReadQrRef = useRef(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const token = extractQrToken(searchParams.get("token") ?? "");

    if (token) {
      router.replace(`/scanner/result?token=${encodeURIComponent(token)}`);
    }
  }, [router, searchParams]);

  const safeStopScanner = useCallback(async () => {
    const scanner = scannerRef.current;

    if (!scanner) {
      isRunningRef.current = false;
      return;
    }

    try {
      if (isRunningRef.current) {
        await scanner.stop();
      }
    } catch (err) {
      console.warn("El escáner ya estaba detenido o no llegó a iniciarse:", err);
    }

    try {
      scanner.clear();
    } catch (err) {
      console.warn("No se pudo limpiar el escáner:", err);
    }

    scannerRef.current = null;
    isRunningRef.current = false;
  }, []);

  useEffect(() => {
    return () => {
      safeStopScanner();
    };
  }, [safeStopScanner]);

  const loadCameras = async () => {
    setError(null);
    setLoadingCameras(true);

    try {
      const devices = await Html5Qrcode.getCameras();
      const nextCameras = devices.map((device, index) => ({
        id: device.id,
        label: device.label || `Cámara ${index + 1}`,
      }));

      setCameras(nextCameras);

      if (nextCameras.length === 0) {
        setError("No se ha encontrado ninguna cámara.");
        return [];
      }

      const cameraId = getPreferredCamera(nextCameras);
      setSelectedCameraId(cameraId);
      return nextCameras;
    } catch (err) {
      const msg = err instanceof DOMException && err.name === "NotAllowedError"
        ? "Permiso de cámara denegado. Actívalo en la configuración del navegador."
        : "No se pudo listar las cámaras. Revisa los permisos del navegador.";
      setError(msg);
      return [];
    } finally {
      setLoadingCameras(false);
    }
  };

  const startScanner = async (cameraIdOverride?: string) => {
    setError(null);
    setScanning(true);
    hasReadQrRef.current = false;

    try {
      await waitForScannerElement();
      await safeStopScanner();

      const availableCameras = cameras.length > 0 ? cameras : await loadCameras();
      const cameraId = cameraIdOverride || selectedCameraId || getPreferredCamera(availableCameras);

      if (!cameraId) {
        setScanning(false);
        return;
      }

      window.localStorage.setItem(LAST_CAMERA_KEY, cameraId);
      setSelectedCameraId(cameraId);
      setActiveCameraId(cameraId);

      const scanner = new Html5Qrcode("scanner-element");
      scannerRef.current = scanner;

      await scanner.start(
        cameraId,
        {
          fps: 15,
          qrbox: (viewfinderWidth, viewfinderHeight) => {
            const size = Math.floor(
              Math.min(viewfinderWidth * 0.96, viewfinderHeight * 0.96)
            );
            const safeSize = Math.max(size, 260);
            return { width: safeSize, height: safeSize };
          },
        },
        async (decodedText) => {
          if (hasReadQrRef.current) return;

          const token = extractQrToken(decodedText);

          if (!token) {
            setError("QR no válido. Intenta escanear de nuevo.");
            return;
          }

          hasReadQrRef.current = true;
          await safeStopScanner();
          setScanning(false);
          setActiveCameraId("");
          router.push(`/scanner/result?token=${encodeURIComponent(token)}`);
        },
        () => {}
      );

      isRunningRef.current = true;
    } catch (err) {
      console.error("No se pudo iniciar el escáner:", err);
      await safeStopScanner();
      setError("No se pudo acceder a la cámara. Prueba otra cámara o revisa los permisos.");
      setScanning(false);
      setActiveCameraId("");
    }
  };

  const stopScanner = async () => {
    await safeStopScanner();
    setScanning(false);
    setActiveCameraId("");
  };

  const handleCameraChange = (cameraId: string) => {
    setSelectedCameraId(cameraId);
    window.localStorage.setItem(LAST_CAMERA_KEY, cameraId);
  };

  const switchCamera = async () => {
    const availableCameras = cameras.length > 0 ? cameras : await loadCameras();

    if (availableCameras.length < 2) {
      setError("Solo hay una cámara disponible.");
      return;
    }

    const currentIndex = Math.max(
      availableCameras.findIndex((camera) => camera.id === activeCameraId),
      0
    );
    const nextCamera = availableCameras[(currentIndex + 1) % availableCameras.length];

    await startScanner(nextCamera.id);
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

      <div className="flex-1 flex flex-col items-center justify-center px-3 py-5 sm:p-6">
        {!scanning ? (
          <div className="w-full max-w-sm text-center space-y-5">
            <div className="w-24 h-24 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
                <path d="M3 7V5a2 2 0 012-2h2" /><path d="M17 3h2a2 2 0 012 2v2" /><path d="M21 17v2a2 2 0 01-2 2h-2" /><path d="M7 21H5a2 2 0 01-2-2v-2" /><rect x="7" y="7" width="10" height="10" rx="2" />
              </svg>
            </div>
            <p className="text-muted-foreground">
              Escanea el código QR de la pulsera del socio
            </p>
            <div className="space-y-3">
              <button
                onClick={loadCameras}
                disabled={loadingCameras}
                className="w-full py-2.5 px-5 border border-border rounded-xl font-medium hover:bg-muted transition-colors disabled:opacity-50"
              >
                {loadingCameras ? "Buscando cámaras..." : "Elegir cámara"}
              </button>
              {cameras.length > 0 && (
                <select
                  value={selectedCameraId}
                  onChange={(event) => handleCameraChange(event.target.value)}
                  className="w-full px-4 py-3 border border-border rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                >
                  {cameras.map((camera) => (
                    <option key={camera.id} value={camera.id}>
                      {camera.label}
                    </option>
                  ))}
                </select>
              )}
            </div>
            <button
              onClick={() => startScanner()}
              disabled={loadingCameras}
              className="py-3 px-8 bg-primary text-primary-foreground rounded-xl text-lg font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              Activar Cámara
            </button>
            {error && (
              <p className="text-destructive text-sm">{error}</p>
            )}
          </div>
        ) : (
          <div className="w-full max-w-2xl space-y-4">
            <div
              id="scanner-element"
              className="w-full min-h-[430px] h-[62dvh] max-h-[680px] rounded-xl overflow-hidden bg-black [&_video]:!h-full [&_video]:!w-full [&_video]:!object-cover"
            />
            <p className="text-xs text-muted-foreground text-center">
              Si no lee la pulsera, prueba otra cámara y acerca o aleja despacio hasta que enfoque.
            </p>
            <button
              onClick={switchCamera}
              disabled={loadingCameras}
              className="w-full py-3 px-6 border border-border rounded-xl font-medium hover:bg-muted transition-colors disabled:opacity-50"
            >
              Cambiar cámara
            </button>
            {error && (
              <p className="text-destructive text-sm text-center">{error}</p>
            )}
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

export default function ScannerPage() {
  return (
    <Suspense
      fallback={
        <main className="flex-1 flex items-center justify-center p-6">
          <p className="text-muted-foreground">Cargando...</p>
        </main>
      }
    >
      <ScannerAccessGate>
        <ScannerContent />
      </ScannerAccessGate>
    </Suspense>
  );
}
