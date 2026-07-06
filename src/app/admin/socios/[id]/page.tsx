"use client";

import { useState, useEffect, FormEvent } from "react";
import { useParams, useRouter } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { formatEuro } from "@/lib/utils";
import { ArrowLeft, QrCode, RefreshCw } from "lucide-react";

interface Socio {
  id: number;
  numeroSocio: string;
  nombre: string;
  apellido1: string | null;
  apellido2: string | null;
  dni: string | null;
  tipoVinculacion: string;
  fechaNacimiento: string | null;
  credito: number;
  estadoPulsera: string;
  qrToken: string;
}

interface Transaccion {
  id: number;
  tipo: string;
  cantidad: number;
  descripcion: string | null;
  createdAt: string;
  puntoVenta: { nombre: string } | null;
}

export default function SocioDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [socio, setSocio] = useState<Socio | null>(null);
  const [transacciones, setTransacciones] = useState<Transaccion[]>([]);
  const [loading, setLoading] = useState(true);
  const [montoCarga, setMontoCarga] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [editNombre, setEditNombre] = useState("");
  const [editApellido1, setEditApellido1] = useState("");
  const [editApellido2, setEditApellido2] = useState("");
  const [editTipo, setEditTipo] = useState("");
  const [editFechaNac, setEditFechaNac] = useState("");
  const [editando, setEditando] = useState(false);

  useEffect(() => {
    const id = params.id;
    Promise.all([
      fetch(`/api/socios/${id}`).then((r) => r.json()),
      fetch(`/api/socios/${id}/transacciones`).then((r) => r.json()),
    ]).then(([socioData, transData]) => {
      setSocio(socioData);
      setTransacciones(transData);
      setLoading(false);
    });
  }, [params.id]);

  const togglePulsera = async () => {
    setError(null);
    const res = await fetch(`/api/socios/${params.id}/toggle-pulsera`, {
      method: "PATCH",
    });
    if (res.ok) {
      const updated = await res.json();
      setSocio(updated);
    }
  };

  const cargarCredito = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const cantidad = parseFloat(montoCarga);
    if (isNaN(cantidad) || cantidad <= 0) return;

    const res = await fetch(`/api/socios/${params.id}/credito`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cantidad }),
    });

    if (res.ok) {
      const updated = await res.json();
      setSocio(updated);
      setMontoCarga("");
      const transRes = await fetch(`/api/socios/${params.id}/transacciones`);
      setTransacciones(await transRes.json());
    } else {
      const data = await res.json();
      setError(data.error);
    }
  };

  const regenerarQr = async () => {
    if (!confirm("¿Regenerar el QR? El código actual dejará de funcionar y la pulsera se marcará como perdida.")) return;
    setError(null);
    const res = await fetch(`/api/socios/${params.id}/regenerar-qr`, {
      method: "PATCH",
    });
    if (res.ok) {
      const updated = await res.json();
      setSocio(updated);
    }
  };

  const guardarCambios = async () => {
    if (!socio) return;
    setError(null);
    const res = await fetch(`/api/socios/${params.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nombre: editNombre,
        numeroSocio: socio.numeroSocio,
        apellido1: editApellido1 || null,
        apellido2: editApellido2 || null,
        tipoVinculacion: editTipo || null,
        fechaNacimiento: editFechaNac ? new Date(editFechaNac).toISOString() : null,
      }),
    });
    if (res.ok) {
      const updated = await res.json();
      setSocio(updated);
      setEditando(false);
    } else {
      const data = await res.json();
      setError(data.error);
    }
  };

  const deleteSocio = async () => {
    if (!confirm("¿Eliminar este socio? Esta acción no se puede deshacer.")) return;
    const res = await fetch(`/api/socios/${params.id}`, {
      method: "DELETE",
    });
    if (res.ok) {
      router.push("/admin/socios");
    }
  };

  if (loading) {
    return <div className="p-6 text-muted-foreground">Cargando...</div>;
  }

  if (!socio) {
    return <div className="p-6 text-muted-foreground">Socio no encontrado</div>;
  }

  const qrUrl = typeof window !== "undefined"
    ? `${window.location.origin}/scanner/result?token=${socio.qrToken}`
    : "";

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-2xl">
      <button
        onClick={() => router.back()}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="w-4 h-4" /> Volver
      </button>

      <div className="bg-white border border-border rounded-xl p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            {editando ? (
              <div className="space-y-2">
                <input
                  value={editNombre}
                  onChange={(e) => setEditNombre(e.target.value)}
                  placeholder="Nombre"
                  className="w-full px-3 py-2 border border-border rounded-lg text-lg font-bold focus:outline-none focus:ring-2 focus:ring-primary/20"
                  autoFocus
                />
                <input
                  value={editApellido1}
                  onChange={(e) => setEditApellido1(e.target.value)}
                  placeholder="Primer apellido"
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
                <input
                  value={editApellido2}
                  onChange={(e) => setEditApellido2(e.target.value)}
                  placeholder="Segundo apellido (opcional)"
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
                <select
                  value={editTipo}
                  onChange={(e) => setEditTipo(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  <option value="socio">Socio</option>
                  <option value="hijos_mayores">Hijo mayor</option>
                  <option value="socios_menores">Socio menor</option>
                  <option value="hijo_socio">Hijo menor</option>
                </select>
                <input
                  type="date"
                  value={editFechaNac}
                  onChange={(e) => setEditFechaNac(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
            ) : (
              <>
                <h1 className="text-2xl font-bold truncate">{socio.nombre}</h1>
                {socio.apellido1 && (
                  <p className="text-muted-foreground text-sm">{socio.apellido1}{socio.apellido2 ? ` ${socio.apellido2}` : ""}</p>
                )}
                <div className="flex gap-3 mt-1">
                  <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground capitalize">
                    {socio.tipoVinculacion.replace("_", " ")}
                  </span>
                  {socio.fechaNacimiento && (
                    <span className="text-xs text-muted-foreground">
                                      {new Date(socio.fechaNacimiento).toLocaleDateString("es-ES")}
                    </span>
                  )}
                </div>
              </>
            )}
            <p className="text-muted-foreground mt-1">#{socio.numeroSocio}</p>
          </div>
          <span
            className={`shrink-0 px-3 py-1 rounded-full text-xs font-medium ${
              socio.estadoPulsera === "activa"
                ? "bg-green-100 text-green-700"
                : socio.estadoPulsera === "perdida"
                ? "bg-orange-100 text-orange-700"
                : "bg-red-100 text-red-700"
            }`}
          >
            {socio.estadoPulsera === "activa"
              ? "Activa"
              : socio.estadoPulsera === "perdida"
              ? "Perdida"
              : "Inactiva"}
          </span>
        </div>

        <div className="mt-6 flex items-center gap-4">
          <span className="text-3xl font-bold">{formatEuro(socio.credito)}</span>
        </div>

        {error && <p className="mt-2 text-destructive text-sm">{error}</p>}

        <div className="mt-4 flex gap-2 flex-wrap">
          {editando ? (
            <>
              <button
                onClick={guardarCambios}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:opacity-90 transition-colors"
              >
                Guardar
              </button>
              <button
                onClick={() => setEditando(false)}
                className="px-4 py-2 rounded-lg text-sm font-medium border border-border hover:bg-muted transition-colors"
              >
                Cancelar
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => {
                  setEditNombre(socio.nombre);
                  setEditApellido1(socio.apellido1 ?? "");
                  setEditApellido2(socio.apellido2 ?? "");
                  setEditTipo(socio.tipoVinculacion);
                  setEditFechaNac(socio.fechaNacimiento ? socio.fechaNacimiento.split("T")[0] : "");
                  setEditando(true);
                }}
                className="px-4 py-2 rounded-lg text-sm font-medium border border-border hover:bg-muted transition-colors"
              >
                Editar
              </button>
              <button
                onClick={togglePulsera}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  socio.estadoPulsera === "activa"
                    ? "bg-red-100 text-red-700 hover:bg-red-200"
                    : "bg-green-100 text-green-700 hover:bg-green-200"
                }`}
              >
                {socio.estadoPulsera === "activa"
                  ? "Desactivar Pulsera"
                  : "Activar Pulsera"}
              </button>
              <button
                onClick={regenerarQr}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-orange-100 text-orange-700 hover:bg-orange-200 transition-colors flex items-center gap-1"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Regenerar QR
              </button>
              <button
                onClick={deleteSocio}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-red-100 text-red-700 hover:bg-red-200 transition-colors"
              >
                Eliminar
              </button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white border border-border rounded-xl p-6 space-y-4">
          <h2 className="font-semibold flex items-center gap-2">
            <QrCode className="w-4 h-4" /> QR de Pulsera
          </h2>
          <div className="flex justify-center">
            <div className="inline-block p-3 bg-white rounded-lg border border-border">
              <QRCodeSVG value={qrUrl} size={180} />
            </div>
          </div>
          <p className="text-xs text-muted-foreground text-center break-all">
            {qrUrl}
          </p>
          <button
            onClick={async () => {
              const qrModule = await import("qrcode");
              const qrUrl = `${window.location.origin}/scanner/result?token=${socio.qrToken}`;
              const url = await qrModule.default.toDataURL(qrUrl, {
                width: 500,
                margin: 2,
              });
              const a = document.createElement("a");
              a.href = url;
              a.download = `qr-${socio.numeroSocio}.png`;
              a.click();
            }}
            className="w-full py-2 border border-border rounded-lg text-sm font-medium hover:bg-muted transition-colors"
          >
            Descargar QR
          </button>
        </div>

        <div className="bg-white border border-border rounded-xl p-6 space-y-4">
          <h2 className="font-semibold">Cargar Crédito</h2>
          <form onSubmit={cargarCredito} className="space-y-3">
            <input
              type="number"
              step="0.01"
              min="0"
              value={montoCarga}
              onChange={(e) => setMontoCarga(e.target.value)}
              placeholder="Cantidad (€)"
              className="w-full px-4 py-2.5 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
            {error && <p className="text-destructive text-sm">{error}</p>}
            <button
              type="submit"
              disabled={!montoCarga || parseFloat(montoCarga) <= 0}
              className="w-full py-2.5 bg-green-600 text-white rounded-xl font-medium hover:bg-green-700 transition-colors disabled:opacity-50"
            >
              Cargar Crédito
            </button>
          </form>
        </div>
      </div>

      <div className="bg-white border border-border rounded-xl">
        <div className="px-4 py-3 border-b border-border">
          <h2 className="font-semibold">Historial</h2>
        </div>
        <div className="divide-y divide-border">
          {transacciones.length === 0 ? (
            <p className="p-4 text-muted-foreground text-sm">
              Sin movimientos
            </p>
          ) : (
            transacciones.map((t) => (
              <div key={t.id} className="px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">
                    {t.tipo === "carga" ? "Carga" : "Consumición"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t.descripcion && <>{t.descripcion}<br /></>}
                    {t.puntoVenta?.nombre && <>Punto: {t.puntoVenta.nombre}<br /></>}
                    {new Date(t.createdAt).toLocaleString("es-ES")}
                  </p>
                </div>
                <span
                  className={`font-semibold ${
                    t.tipo === "carga" ? "text-green-600" : "text-red-600"
                  }`}
                >
                  {t.tipo === "carga" ? "+" : "-"}
                  {formatEuro(t.cantidad)}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
