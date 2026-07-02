"use client";

import { useState, useEffect, useCallback, FormEvent } from "react";
import { Plus, Pencil, Trash2, X, Check, Ban } from "lucide-react";

interface Punto {
  id: number;
  nombre: string;
  permiso: string;
  activo: boolean;
}

export default function PuntosPage() {
  const [puntos, setPuntos] = useState<Punto[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editPunto, setEditPunto] = useState<Punto | null>(null);
  const [nombre, setNombre] = useState("");
  const [password, setPassword] = useState("");
  const [permiso, setPermiso] = useState("barra");

  const fetchPuntos = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/puntos");
      setPuntos(await res.json());
    } catch {
      setPuntos([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchPuntos(); }, [fetchPuntos]);

  const resetForm = () => {
    setNombre("");
    setPassword("");
    setPermiso("barra");
    setEditPunto(null);
    setShowForm(false);
  };

  const openEdit = (p: Punto) => {
    setNombre(p.nombre);
    setPermiso(p.permiso);
    setPassword("");
    setEditPunto(p);
    setShowForm(true);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (editPunto) {
      const body: Record<string, unknown> = { nombre, permiso };
      if (password) body.password = password;
      await fetch(`/api/puntos/${editPunto.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } else {
      await fetch("/api/puntos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre, password, permiso }),
      });
    }
    resetForm();
    fetchPuntos();
  };

  const toggleActivo = async (p: Punto) => {
    await fetch(`/api/puntos/${p.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activo: !p.activo }),
    });
    fetchPuntos();
  };

  const deletePunto = async (id: number, nombre: string) => {
    if (!confirm(`¿Eliminar "${nombre}"? Las transacciones de este punto no se perderán.`)) return;
    await fetch(`/api/puntos/${id}`, { method: "DELETE" });
    fetchPuntos();
  };

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Puntos de Venta</h1>
        <button
          onClick={() => { resetForm(); setShowForm(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90"
        >
          <Plus className="w-4 h-4" /> Nuevo Punto
        </button>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-lg">
                {editPunto ? "Editar Punto" : "Nuevo Punto"}
              </h2>
              <button onClick={resetForm} className="p-1 hover:bg-muted rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">Nombre</label>
                <input
                  type="text"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  className="w-full px-4 py-2.5 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Contraseña {editPunto && <span className="text-muted-foreground font-normal">(dejar vacío para no cambiar)</span>}
                </label>
                <input
                  type="text"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-2.5 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20"
                  required={!editPunto}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Permiso</label>
                <select
                  value={permiso}
                  onChange={(e) => setPermiso(e.target.value)}
                  className="w-full px-4 py-2.5 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 bg-white"
                >
                  <option value="barra">Barra (cobrar)</option>
                  <option value="caja">Caja (recargar)</option>
                </select>
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={!nombre || (!editPunto && !password)}
                  className="flex-1 py-2.5 bg-primary text-primary-foreground rounded-xl font-medium hover:opacity-90 disabled:opacity-50"
                >
                  {editPunto ? "Guardar" : "Crear"}
                </button>
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-4 py-2.5 border border-border rounded-xl font-medium hover:bg-muted"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="bg-white border border-border rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-muted-foreground">Cargando...</div>
        ) : puntos.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            No hay puntos de venta. Crea el primero.
          </div>
        ) : (
          <div className="divide-y divide-border">
            {puntos.map((p) => (
              <div key={p.id} className="flex items-center gap-4 px-4 py-3 hover:bg-muted/50">
                <div className="flex-1 min-w-0">
                  <p className="font-medium">{p.nombre}</p>
                  <p className="text-sm text-muted-foreground capitalize">
                    {p.permiso === "barra" ? "Barra (cobrar)" : "Caja (recargar)"}
                  </p>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                  p.activo ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                }`}>
                  {p.activo ? "Activo" : "Inactivo"}
                </span>
                <div className="flex gap-1">
                  <button
                    onClick={() => toggleActivo(p)}
                    className={`p-2 rounded-lg transition-colors ${
                      p.activo
                        ? "text-amber-600 hover:bg-amber-100"
                        : "text-green-600 hover:bg-green-100"
                    }`}
                    title={p.activo ? "Desactivar" : "Activar"}
                  >
                    {p.activo ? <Ban className="w-4 h-4" /> : <Check className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => openEdit(p)}
                    className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => deletePunto(p.id, p.nombre)}
                    className="p-2 text-muted-foreground hover:text-red-600 hover:bg-red-100 rounded-lg"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
