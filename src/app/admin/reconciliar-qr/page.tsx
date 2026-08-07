"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { CheckCircle2, Copy, Link2, QrCode, Search, UserRound, XCircle } from "lucide-react";

import { extractQrToken } from "@/lib/qr";

interface CameraDevice {
  id: string;
  label: string;
}

interface Socio {
  id: number;
  nombre: string;
  apellido1: string | null;
  apellido2: string | null;
  numeroSocio: string;
  estadoPulsera: string;
  qrToken: string;
}

const LAST_CAMERA_KEY = "comparsa_reconcile_camera_id";

function getFullName(socio: Pick<Socio, "nombre" | "apellido1" | "apellido2">) {
  return [socio.nombre, socio.apellido1, socio.apellido2].filter(Boolean).join(" ");
}

function getPreferredCamera(cameras: CameraDevice[]) {
  const storedCameraId = window.localStorage.getItem(LAST_CAMERA_KEY);
  const storedCamera = cameras.find((camera) => camera.id === storedCameraId);
  if (storedCamera) return storedCamera.id;

  const backCamera = cameras.find((camera) =>
    /back|rear|environment|trasera|posterior|espalda/i.test(camera.label),
  );

  return backCamera?.id ?? cameras[0]?.id ?? "";
}

export default function ReconciliarQrPage() {
  const [cameras, setCameras] = useState<CameraDevice[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState("");
  const [scanning, setScanning] = useState(false);
  const [scannedToken, setScannedToken] = useState("");
  const [resolvedSocio, setResolvedSocio] = useState<Socio | null>(null);
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<Socio[]>([]);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const hasReadQrRef = useRef(false);

  const unresolved = Boolean(scannedToken) && !resolvedSocio && !resolving;

  const safeStopScanner = useCallback(async () => {
    const scanner = scannerRef.current;
    if (!scanner) return;

    try {
      if (scanner.isScanning) {
        await scanner.stop();
      }
    } catch {}

    try {
      await scanner.clear();
    } catch {}

    scannerRef.current = null;
  }, []);

  useEffect(() => {
    return () => {
      void safeStopScanner();
    };
  }, [safeStopScanner]);

  const loadCameras = useCallback(async () => {
    const devices = await Html5Qrcode.getCameras();
    const nextCameras = devices.map((device, index) => ({
      id: device.id,
      label: device.label || `Cámara ${index + 1}`,
    }));

    setCameras(nextCameras);
    const preferred = getPreferredCamera(nextCameras);
    setSelectedCameraId(preferred);
    return { nextCameras, preferred };
  }, []);

  const resolveToken = useCallback(async (token: string) => {
    setResolving(true);
    setResolvedSocio(null);
    setError(null);
    setInfo(null);

    try {
      const res = await fetch(`/api/scanner/${encodeURIComponent(token)}`);
      const data = await res.json().catch(() => null);

      if (res.ok) {
        setResolvedSocio(data);
        setInfo(`QR vinculado a ${data.nombre} (#${data.numeroSocio})`);
        return;
      }

      if (res.status === 404) {
        setInfo("QR no vinculado. Buscá el socio correcto para reconciliarlo.");
        return;
      }

      throw new Error(data?.error ?? "No se pudo comprobar el QR");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo comprobar el QR");
    } finally {
      setResolving(false);
    }
  }, []);

  const startScanner = useCallback(async () => {
    setError(null);
    setInfo(null);
    hasReadQrRef.current = false;
    setScanning(true);

    try {
      await safeStopScanner();
      const { nextCameras, preferred } = cameras.length > 0
        ? { nextCameras: cameras, preferred: selectedCameraId || getPreferredCamera(cameras) }
        : await loadCameras();

      const cameraId = selectedCameraId || preferred || getPreferredCamera(nextCameras);
      if (!cameraId) {
        throw new Error("No se ha encontrado ninguna cámara.");
      }

      window.localStorage.setItem(LAST_CAMERA_KEY, cameraId);
      setSelectedCameraId(cameraId);

      const scanner = new Html5Qrcode("reconcile-scanner");
      scannerRef.current = scanner;

      await scanner.start(
        cameraId,
        { fps: 15, qrbox: { width: 280, height: 280 } },
        async (decodedText) => {
          if (hasReadQrRef.current) return;

          const token = extractQrToken(decodedText);
          if (!token) {
            setError("QR no válido. Intenta de nuevo.");
            return;
          }

          hasReadQrRef.current = true;
          setScannedToken(token);
          setSearch("");
          setSearchResults([]);
          await safeStopScanner();
          setScanning(false);
          await resolveToken(token);
        },
        () => {},
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo iniciar la cámara");
      setScanning(false);
      await safeStopScanner();
    }
  }, [cameras, loadCameras, resolveToken, safeStopScanner, selectedCameraId]);

  const stopScanner = useCallback(async () => {
    await safeStopScanner();
    setScanning(false);
  }, [safeStopScanner]);

  useEffect(() => {
    if (!unresolved || search.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setLoadingSearch(true);
      try {
        const params = new URLSearchParams({ search, page: "1", limit: "20" });
        const res = await fetch(`/api/socios?${params.toString()}`);
        if (!res.ok) throw new Error("No se pudieron cargar socios");
        const data = await res.json();
        setSearchResults(data.socios ?? []);
      } catch {
        setSearchResults([]);
      } finally {
        setLoadingSearch(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [search, unresolved]);

  const copyToken = useCallback(async () => {
    if (!scannedToken) return;
    await navigator.clipboard.writeText(scannedToken);
    setInfo("Token copiado al portapapeles.");
  }, [scannedToken]);

  const reconcile = useCallback(async (socio: Socio) => {
    if (!scannedToken) return;
    const ok = window.confirm(`¿Vincular este QR a ${getFullName(socio)} (#${socio.numeroSocio})?`);
    if (!ok) return;

    setSaving(true);
    setError(null);
    setInfo(null);

    try {
      const res = await fetch("/api/socios/reconciliar-qr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ socioId: socio.id, currentToken: scannedToken }),
      });
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(data?.error ?? "No se pudo reconciliar el QR");
      }

      setResolvedSocio(data);
      setInfo(`QR reconciliado con ${data.nombre} (#${data.numeroSocio}).`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo reconciliar el QR");
    } finally {
      setSaving(false);
    }
  }, [scannedToken]);

  const statusTone = useMemo(() => {
    if (error) return "border-red-200 bg-red-50 text-red-700";
    if (resolvedSocio) return "border-green-200 bg-green-50 text-green-700";
    if (unresolved) return "border-amber-200 bg-amber-50 text-amber-700";
    return "border-border bg-white text-foreground";
  }, [error, resolvedSocio, unresolved]);

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold">Reconciliar QR</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Escaneá un QR impreso. Si ya está vinculado, verás el socio. Si no, podrás reasignarlo de forma segura.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <section className="bg-white border border-border rounded-xl p-4 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold flex items-center gap-2"><QrCode className="w-4 h-4" /> Escáner</h2>
              <p className="text-xs text-muted-foreground">Podés cambiar de cámara antes de escanear.</p>
            </div>
            {scanning ? (
              <button onClick={() => void stopScanner()} className="px-4 py-2 border border-red-200 text-red-700 rounded-lg text-sm font-medium hover:bg-red-50">
                Detener
              </button>
            ) : (
              <button onClick={() => void startScanner()} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90">
                Abrir escáner
              </button>
            )}
          </div>

          {cameras.length > 0 && !scanning && (
            <select
              value={selectedCameraId}
              onChange={(event) => setSelectedCameraId(event.target.value)}
              className="w-full px-3 py-2.5 border border-border rounded-xl bg-white"
            >
              {cameras.map((camera) => (
                <option key={camera.id} value={camera.id}>{camera.label}</option>
              ))}
            </select>
          )}

          <div id="reconcile-scanner" className="w-full min-h-[340px] rounded-xl overflow-hidden bg-black/90 [&_video]:!w-full [&_video]:!h-full [&_video]:!object-cover" />
        </section>

        <section className={`border rounded-xl p-4 space-y-4 ${statusTone}`}>
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-semibold flex items-center gap-2"><Link2 className="w-4 h-4" /> Estado del QR</h2>
            {scannedToken && (
              <button onClick={() => void copyToken()} className="inline-flex items-center gap-2 text-xs px-3 py-1.5 border border-current/20 rounded-lg hover:bg-black/5">
                <Copy className="w-3.5 h-3.5" /> Copiar token
              </button>
            )}
          </div>

          {!scannedToken ? (
            <p className="text-sm text-muted-foreground">Todavía no se ha leído ningún QR.</p>
          ) : (
            <>
              <div className="space-y-1">
                <p className="text-xs uppercase tracking-wide opacity-70">Token leído</p>
                <p className="font-mono text-xs break-all">{scannedToken}</p>
              </div>

              {resolving && <p className="text-sm">Comprobando QR...</p>}
              {error && <p className="text-sm font-medium">{error}</p>}
              {info && <p className="text-sm font-medium">{info}</p>}

              {resolvedSocio && (
                <div className="rounded-xl border border-green-200 bg-white/70 p-4 space-y-2">
                  <div className="flex items-center gap-2 text-green-700 font-semibold">
                    <CheckCircle2 className="w-4 h-4" /> QR vinculado
                  </div>
                  <p className="font-semibold">{getFullName(resolvedSocio)}</p>
                  <p className="text-sm text-muted-foreground">#{resolvedSocio.numeroSocio}</p>
                  <p className="text-xs text-muted-foreground">Estado de pulsera: {resolvedSocio.estadoPulsera}</p>
                </div>
              )}

              {unresolved && (
                <div className="rounded-xl border border-amber-200 bg-white/70 p-4 space-y-3">
                  <div className="flex items-center gap-2 text-amber-700 font-semibold">
                    <XCircle className="w-4 h-4" /> QR no vinculado
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Buscá el socio correcto por número o nombre y vincula este token impreso.
                  </p>
                </div>
              )}
            </>
          )}
        </section>
      </div>

      {unresolved && (
        <section className="bg-white border border-border rounded-xl p-4 space-y-4">
          <div>
            <h2 className="font-semibold flex items-center gap-2"><UserRound className="w-4 h-4" /> Buscar socio para reconciliar</h2>
            <p className="text-xs text-muted-foreground">Buscá por número, nombre o apellido y elige el socio correcto.</p>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Ej: s-001, Ada, Lovelace..."
              className="w-full pl-10 pr-4 py-2.5 border border-border rounded-xl"
            />
          </div>

          {loadingSearch ? (
            <p className="text-sm text-muted-foreground">Buscando socios...</p>
          ) : search.trim().length < 2 ? (
            <p className="text-sm text-muted-foreground">Escribe al menos 2 caracteres para buscar.</p>
          ) : searchResults.length === 0 ? (
            <p className="text-sm text-muted-foreground">No se encontraron socios con ese criterio.</p>
          ) : (
            <div className="divide-y divide-border border border-border rounded-xl overflow-hidden">
              {searchResults.map((socio) => (
                <div key={socio.id} className="flex items-center justify-between gap-3 p-4">
                  <div>
                    <p className="font-medium">{getFullName(socio)}</p>
                    <p className="text-sm text-muted-foreground">#{socio.numeroSocio}</p>
                    <p className="text-xs text-muted-foreground">Token actual: {socio.qrToken}</p>
                  </div>
                  <button
                    onClick={() => void reconcile(socio)}
                    disabled={saving}
                    className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50"
                  >
                    {saving ? "Guardando..." : "Vincular"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
