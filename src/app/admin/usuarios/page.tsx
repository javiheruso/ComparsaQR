"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { KeyRound, Plus, ShieldCheck, UserRound } from "lucide-react";

interface AdminUser {
  id: number;
  username: string;
  nombre: string;
  activo: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function AdminUsersPage() {
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nombre, setNombre] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const loadAdmins = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin-users");
      if (res.status === 401) {
        window.location.href = "/";
        return;
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "No se pudieron cargar los administradores");
      setAdmins(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron cargar los administradores");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAdmins();
  }, [loadAdmins]);

  const createAdmin = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const res = await fetch("/api/admin-users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre, username, password }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error ?? "No se pudo crear el administrador");
      }
      setNombre("");
      setUsername("");
      setPassword("");
      await loadAdmins();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear el administrador");
    } finally {
      setSaving(false);
    }
  };

  const toggleActivo = async (admin: AdminUser) => {
    setError(null);
    try {
      const res = await fetch(`/api/admin-users/${admin.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activo: !admin.activo }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error ?? "No se pudo actualizar el administrador");
      }
      await loadAdmins();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo actualizar el administrador");
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold">Usuarios Admin</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Cada miembro entra con su propio usuario para que recargas, puntos y gestión de QR queden bien trazados.
        </p>
      </div>

      <section className="bg-white border border-border rounded-xl p-5 space-y-4">
        <h2 className="font-semibold flex items-center gap-2"><Plus className="w-4 h-4" /> Nuevo administrador</h2>
        <form onSubmit={createAdmin} className="grid gap-3 md:grid-cols-3">
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre visible" className="px-4 py-3 border border-border rounded-xl" required />
          <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Usuario" className="px-4 py-3 border border-border rounded-xl" autoCapitalize="none" required />
          <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Contraseña" type="password" className="px-4 py-3 border border-border rounded-xl" required />
          <div className="md:col-span-3 flex justify-end">
            <button type="submit" disabled={saving || !nombre || !username || !password} className="px-4 py-2.5 bg-primary text-primary-foreground rounded-xl font-medium hover:opacity-90 disabled:opacity-50">
              {saving ? "Creando..." : "Crear administrador"}
            </button>
          </div>
        </form>
      </section>

      <section className="bg-white border border-border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center gap-2 font-semibold">
          <ShieldCheck className="w-4 h-4" /> Administradores activos y trazables
        </div>
        {loading ? (
          <div className="p-6 text-muted-foreground">Cargando...</div>
        ) : admins.length === 0 ? (
          <div className="p-6 text-muted-foreground">Todavía no hay administradores creados.</div>
        ) : (
          <div className="divide-y divide-border">
            {admins.map((admin) => (
              <div key={admin.id} className="p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div>
                  <p className="font-medium flex items-center gap-2"><UserRound className="w-4 h-4" /> {admin.nombre}</p>
                  <p className="text-sm text-muted-foreground">@{admin.username}</p>
                  <p className="text-xs text-muted-foreground mt-1">Actualizado: {new Date(admin.updatedAt).toLocaleString("es-ES")}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${admin.activo ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                    {admin.activo ? "Activo" : "Inactivo"}
                  </span>
                  <button onClick={() => void toggleActivo(admin)} className="px-3 py-2 border border-border rounded-lg text-sm font-medium hover:bg-muted">
                    {admin.activo ? "Desactivar" : "Reactivar"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800 flex items-start gap-3">
        <KeyRound className="w-4 h-4 mt-0.5" />
        <p>
          Las recargas y operaciones sensibles dejarán mejor rastro porque cada admin tendrá identidad propia en sesión.
        </p>
      </section>

      {error && <p className="text-destructive text-sm">{error}</p>}
    </div>
  );
}
