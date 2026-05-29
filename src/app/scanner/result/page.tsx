"use client";

import { Suspense, useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { formatEuro } from "@/lib/utils";
import { extractQrToken } from "@/lib/qr";
import { Plus, Minus, ShoppingCart, Wallet } from "lucide-react";

interface SocioData {
  id: number;
  nombre: string;
  numeroSocio: string;
  credito: number;
  estadoPulsera: string;
}

interface Producto {
  id: number;
  nombre: string;
  precio: number;
  imagen: string;
}

function ScannerResultContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = extractQrToken(searchParams.get("token") ?? "");
  const [socio, setSocio] = useState<SocioData | null>(null);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [cantidades, setCantidades] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [mostrarConfirmacion, setMostrarConfirmacion] = useState(false);

  // ─── Cargar saldo ───────────────────────────────────
  const [mostrarCargar, setMostrarCargar] = useState(false);
  const [cargarCantidad, setCargarCantidad] = useState("");
  const [cargarDescripcion, setCargarDescripcion] = useState("");
  const [mostrarAuth, setMostrarAuth] = useState(false);
  const [passwordCarga, setPasswordCarga] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [verificando, setVerificando] = useState(false);

  useEffect(() => {
    if (!token) return;

    Promise.all([
      fetch(`/api/scanner/${encodeURIComponent(token)}`).then(async (res) => {
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error);
        }
        return res.json();
      }),
      fetch("/api/productos").then((r) => r.json()),
    ])
      .then(([socioData, productosData]) => {
        setSocio(socioData);
        setProductos(productosData);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [token]);

  if (!token) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 gap-4">
        <div className="w-20 h-20 rounded-full bg-red-100 flex items-center justify-center">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-red-600">
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
          </svg>
        </div>
        <p className="text-xl font-semibold text-red-600">QR no válido</p>
        <button
          onClick={() => router.push("/scanner")}
          className="mt-4 px-6 py-3 bg-primary text-primary-foreground rounded-xl font-semibold"
        >
          Volver al Escáner
        </button>
      </div>
    );
  }

  const totalSeleccionado = Object.entries(cantidades).reduce(
    (sum, [id, qty]) => {
      const prod = productos.find((p) => p.id === parseInt(id));
      return sum + (prod?.precio ?? 0) * qty;
    },
    0
  );

  const totalItems = Object.values(cantidades).reduce((s, q) => s + q, 0);

  const cambiarCantidad = (productoId: number, delta: number) => {
    setCantidades((prev) => {
      const actual = prev[productoId] ?? 0;
      const nueva = actual + delta;
      if (nueva <= 0) {
        const { [productoId]: removed, ...rest } = prev;
        void removed;
        return rest;
      }
      return { ...prev, [productoId]: nueva };
    });
  };

  const cobrar = async () => {
    if (!socio || totalSeleccionado <= 0) return;
    setProcessing(true);

    try {
      const res = await fetch(`/api/socios/${socio.id}/consumo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: Object.entries(cantidades).map(([id, qty]) => ({
            productoId: parseInt(id),
            cantidad: qty,
          })),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Error al procesar");
      }

      const updated = await res.json();
      setSocio(updated);
      setCantidades({});
      setMensaje(`Cobrado ${formatEuro(totalSeleccionado)}`);
      setMostrarConfirmacion(false);
      setTimeout(() => setMensaje(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
      setTimeout(() => setError(null), 3000);
    } finally {
      setProcessing(false);
    }
  };

  // ─── Cargar saldo ───────────────────────────────────
  // ─── Verificar contraseña para cargar saldo ────────
  const verificarParaCargar = async () => {
    if (!passwordCarga) return;
    setVerificando(true);
    setAuthError(null);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: passwordCarga }),
      });

      if (res.ok) {
        setMostrarAuth(false);
        setPasswordCarga("");
        setError(null);
        setCargarCantidad("");
        setCargarDescripcion("");
        setMostrarCargar(true);
      } else {
        setAuthError("Contraseña incorrecta");
      }
    } catch {
      setAuthError("Error de conexión");
    } finally {
      setVerificando(false);
    }
  };

  const cargarSaldo = async () => {
    if (!socio || !cargarCantidad) return;

    const cantidad = parseFloat(cargarCantidad);
    if (isNaN(cantidad) || cantidad <= 0) {
      setError("Introduce una cantidad válida");
      return;
    }

    setProcessing(true);
    setError(null);

    try {
      const res = await fetch(`/api/socios/${socio.id}/credito`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cantidad,
          descripcion: cargarDescripcion || "Carga de saldo desde escáner",
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Error al cargar saldo");
      }

      const updated = await res.json();
      setSocio(updated);
      setCargarCantidad("");
      setCargarDescripcion("");
      setMostrarCargar(false);
      setMensaje(`Saldo cargado: ${formatEuro(cantidad)}`);
      setTimeout(() => setMensaje(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar saldo");
      setTimeout(() => setError(null), 3000);
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <p className="text-muted-foreground">Buscando socio...</p>
      </div>
    );
  }

  if (error && !socio) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 gap-4">
        <div className="w-20 h-20 rounded-full bg-red-100 flex items-center justify-center">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-red-600">
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
          </svg>
        </div>
        <p className="text-xl font-semibold text-red-600">{error}</p>
        <button
          onClick={() => router.push("/scanner")}
          className="mt-4 px-6 py-3 bg-primary text-primary-foreground rounded-xl font-semibold"
        >
          Volver al Escáner
        </button>
      </div>
    );
  }

  if (!socio) return null;

  const pulseraInactiva = socio.estadoPulsera !== "activa";

  return (
    <div className="flex-1 flex flex-col">
      <div className="max-w-lg mx-auto w-full p-4 space-y-4 pb-32">
        {/* Cabecera - Socio */}
        <div className="bg-white border border-border rounded-xl p-4 flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
            <span className="text-xl font-bold text-primary">
              {socio.nombre.charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold truncate">{socio.nombre}</h1>
            <p className="text-sm text-muted-foreground">#{socio.numeroSocio}</p>
          </div>
          <div className="text-right flex-shrink-0">
            <div className="flex items-center gap-1 justify-end">
              <p className="text-xs text-muted-foreground">Crédito</p>
              <button
                onClick={() => {
                  setAuthError(null);
                  setPasswordCarga("");
                  setMostrarAuth(true);
                }}
                className="text-primary hover:opacity-80 transition-opacity"
                title="Cargar saldo"
              >
                <Wallet className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xl font-bold">{formatEuro(socio.credito)}</p>
          </div>
        </div>

        {/* Banner de pulsera inactiva */}
        {pulseraInactiva ? (
          <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
            <p className="text-red-700 font-semibold text-lg">Pulsera Desactivada</p>
            <p className="text-red-600 text-sm mt-1">
              Esta pulsera ha sido desactivada. Contacta con administración.
            </p>
          </div>
        ) : (
          <>
            {/* Mensajes */}
            {mensaje && (
              <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center animate-in fade-in">
                <p className="text-green-700 font-medium">{mensaje}</p>
              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center animate-in fade-in">
                <p className="text-red-700 font-medium">{error}</p>
              </div>
            )}

            {/* Productos */}
            {productos.length === 0 ? (
              <div className="bg-white border border-border rounded-xl p-6 text-center text-muted-foreground">
                No hay productos disponibles
              </div>
            ) : (
              <div className="space-y-2">
                {productos.map((p) => {
                  const qty = cantidades[p.id] ?? 0;
                  return (
                    <div
                      key={p.id}
                      className={`bg-white border rounded-xl p-3 flex items-center gap-3 transition-colors ${
                        qty > 0 ? "border-primary/40 bg-primary/[0.02]" : "border-border"
                      }`}
                    >
                      <div className="w-12 h-12 rounded-lg bg-muted flex-shrink-0 overflow-hidden">
                        {p.imagen ? (
                          <img src={p.imagen} alt={p.nombre} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-lg">
                            {p.nombre.charAt(0).toUpperCase()}
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{p.nombre}</p>
                        <p className="text-sm text-muted-foreground">{p.precio.toFixed(2)}€</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {qty > 0 && (
                          <>
                            <button
                              onClick={() => cambiarCantidad(p.id, -1)}
                              className="w-8 h-8 flex items-center justify-center rounded-lg border border-border hover:bg-muted"
                            >
                              <Minus className="w-4 h-4" />
                            </button>
                            <span className="w-6 text-center font-semibold">{qty}</span>
                          </>
                        )}
                        <button
                          onClick={() => cambiarCantidad(p.id, 1)}
                          className="w-8 h-8 flex items-center justify-center rounded-lg bg-primary text-primary-foreground hover:opacity-90"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* Botón volver a escanear */}
        <button
          onClick={() => router.push("/scanner")}
          className="w-full py-3 border border-border rounded-xl text-sm font-medium hover:bg-muted transition-colors"
        >
          Escanear Otra Pulsera
        </button>
      </div>

      {/* ─── Barra inferior fija: cobrar ───────────────── */}
      {!pulseraInactiva && totalItems > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-border p-4 shadow-lg z-40">
          <div className="max-w-lg mx-auto flex items-center gap-4">
            <div className="flex-1">
              <p className="text-xs text-muted-foreground">
                <ShoppingCart className="w-3 h-3 inline mr-1" />
                {totalItems} producto{totalItems !== 1 ? "s" : ""}
              </p>
              <p className="text-xl font-bold">{formatEuro(totalSeleccionado)}</p>
            </div>
            {totalSeleccionado > (socio?.credito ?? 0) ? (
              <div className="text-right">
                <p className="text-red-600 text-sm font-medium">Crédito insuficiente</p>
                <p className="text-xs text-muted-foreground">
                  Faltan {formatEuro(totalSeleccionado - (socio?.credito ?? 0))}
                </p>
              </div>
            ) : (
              <button
                onClick={() => setMostrarConfirmacion(true)}
                disabled={processing}
                className="px-8 py-3 bg-primary text-primary-foreground rounded-xl font-semibold hover:opacity-90 disabled:opacity-50"
              >
                {processing ? "Cobrando..." : "Cobrar"}
              </button>
            )}
          </div>
        </div>
      )}

      {/* ─── Modal: confirmar cobro ────────────────────── */}
      {mostrarConfirmacion && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm space-y-4">
            <h2 className="text-lg font-bold">Confirmar Cobro</h2>
            <div className="space-y-2">
              {Object.entries(cantidades).map(([id, qty]) => {
                const prod = productos.find((p) => p.id === parseInt(id));
                if (!prod || qty === 0) return null;
                return (
                  <div key={id} className="flex justify-between text-sm">
                    <span>
                      {prod.nombre} x{qty}
                    </span>
                    <span className="font-medium">
                      {(prod.precio * qty).toFixed(2)}€
                    </span>
                  </div>
                );
              })}
              <div className="border-t border-border pt-2 flex justify-between font-bold">
                <span>Total</span>
                <span>{formatEuro(totalSeleccionado)}</span>
              </div>
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Crédito disponible</span>
                <span>{formatEuro(socio?.credito ?? 0)}</span>
              </div>
              <div className="flex justify-between text-sm font-medium">
                <span>Crédito restante</span>
                <span className={((socio?.credito ?? 0) - totalSeleccionado) < 0 ? "text-red-600" : "text-green-600"}>
                  {formatEuro((socio?.credito ?? 0) - totalSeleccionado)}
                </span>
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                onClick={cobrar}
                disabled={processing}
                className="flex-1 py-2.5 bg-primary text-primary-foreground rounded-xl font-medium hover:opacity-90 disabled:opacity-50"
              >
                Confirmar
              </button>
              <button
                onClick={() => setMostrarConfirmacion(false)}
                className="px-4 py-2.5 border border-border rounded-xl font-medium hover:bg-muted"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Modal: verificar contraseña ────────────────── */}
      {mostrarAuth && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm space-y-4">
            <div className="flex items-center gap-2">
              <Wallet className="w-5 h-5 text-amber-600" />
              <h2 className="text-lg font-bold">Cargar Saldo</h2>
            </div>

            <p className="text-sm text-muted-foreground">
              Introduce la contraseña de administrador para poder cargar crédito.
            </p>

            <div>
              <input
                type="password"
                value={passwordCarga}
                onChange={(e) => {
                  setPasswordCarga(e.target.value);
                  setAuthError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") verificarParaCargar();
                }}
                placeholder="Contraseña"
                autoFocus
                className="w-full px-4 py-3 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
              />
            </div>

            {authError && (
              <p className="text-destructive text-sm text-center">{authError}</p>
            )}

            <div className="flex gap-2 pt-2">
              <button
                onClick={verificarParaCargar}
                disabled={verificando || !passwordCarga}
                className="flex-1 py-2.5 bg-amber-600 text-white rounded-xl font-medium hover:bg-amber-700 disabled:opacity-50 transition-colors"
              >
                {verificando ? "Verificando..." : "Verificar"}
              </button>
              <button
                onClick={() => {
                  setMostrarAuth(false);
                  setPasswordCarga("");
                  setAuthError(null);
                }}
                className="px-4 py-2.5 border border-border rounded-xl font-medium hover:bg-muted"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Modal: cargar saldo ───────────────────────── */}
      {mostrarCargar && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm space-y-4">
            <div className="flex items-center gap-2">
              <Wallet className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-bold">Cargar Saldo</h2>
            </div>

            <p className="text-sm text-muted-foreground">
              Añadir crédito a <strong>{socio.nombre}</strong>
              <span className="block text-xs mt-0.5">Saldo actual: {formatEuro(socio.credito)}</span>
            </p>

            <div>
              <label className="block text-sm font-medium mb-1">
                Cantidad (€)
              </label>
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0.01"
                value={cargarCantidad}
                onChange={(e) => setCargarCantidad(e.target.value)}
                placeholder="10.00"
                autoFocus
                className="w-full px-4 py-3 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Concepto <span className="text-muted-foreground font-normal">(opcional)</span>
              </label>
              <input
                type="text"
                value={cargarDescripcion}
                onChange={(e) => setCargarDescripcion(e.target.value)}
                placeholder="Carga de saldo"
                className="w-full px-4 py-3 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={cargarSaldo}
                disabled={processing || !cargarCantidad}
                className="flex-1 py-2.5 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 disabled:opacity-50 transition-colors"
              >
                {processing ? "Cargando..." : "Cargar Saldo"}
              </button>
              <button
                onClick={() => {
                  setMostrarCargar(false);
                  setCargarCantidad("");
                  setCargarDescripcion("");
                }}
                className="px-4 py-2.5 border border-border rounded-xl font-medium hover:bg-muted"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ScannerResultPage() {
  return (
    <main className="flex-1 flex flex-col">
      <Suspense
        fallback={
          <div className="flex-1 flex items-center justify-center p-6">
            <p className="text-muted-foreground">Cargando...</p>
          </div>
        }
      >
        <ScannerResultContent />
      </Suspense>
    </main>
  );
}
