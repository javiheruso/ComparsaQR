"use client";

import Image from "next/image";
import { useEffect, useState, FormEvent } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [hasAdminUsers, setHasAdminUsers] = useState<boolean | null>(null);
  const [nombre, setNombre] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [masterPassword, setMasterPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showMasterPassword, setShowMasterPassword] = useState(false);
  const router = useRouter();

  useEffect(() => {
    fetch("/api/auth/admin-status")
      .then((res) => res.json())
      .then((data) => setHasAdminUsers(Boolean(data?.hasAdminUsers)))
      .catch(() => setHasAdminUsers(true));
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const endpoint = hasAdminUsers ? "/api/auth/login" : "/api/auth/bootstrap-admin";
      const payload = hasAdminUsers
        ? { username, password }
        : { nombre, username, password, masterPassword };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "No se pudo iniciar sesión");
        return;
      }

      const data = await res.json();
      const destino = data.tipo === "admin" ? "/admin" : "/scanner";
      router.push(destino);
      router.refresh();
    } catch {
      setError("Error de conexión");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex-1 flex items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-4">
          <Image
            src="/icon-192.png"
            alt="Logo"
            width={96}
            height={96}
            className="mx-auto"
            priority
          />
          <h1 className="text-4xl font-bold tracking-tight">
            Gestión Barraca
          </h1>
          <p className="text-muted-foreground text-sm">
            {hasAdminUsers === false
              ? "Crea el primer administrador con la clave maestra actual"
              : "Introduce tu usuario y contraseña para acceder"}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {hasAdminUsers === false && (
            <input
              type="text"
              value={nombre}
              onChange={(e) => {
                setNombre(e.target.value);
                setError(null);
              }}
              placeholder="Nombre visible"
              className="w-full px-4 py-3 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
              autoFocus
            />
          )}

          <input
            type="text"
            value={username}
            onChange={(e) => {
              setUsername(e.target.value);
              setError(null);
            }}
            placeholder="Usuario"
            className="w-full px-4 py-3 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            autoFocus={hasAdminUsers !== false}
          />

          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError(null);
              }}
              placeholder="Contraseña"
              className="w-full px-4 py-3 pr-12 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
              autoComplete="current-password"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
            />
            <button
              type="button"
              onClick={() => setShowPassword((visible) => !visible)}
              className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
              aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
            >
              {showPassword ? (
                <EyeOff className="h-5 w-5" />
              ) : (
                <Eye className="h-5 w-5" />
              )}
            </button>
          </div>

          {hasAdminUsers === false && (
            <div className="relative">
              <input
                type={showMasterPassword ? "text" : "password"}
                value={masterPassword}
                onChange={(e) => {
                  setMasterPassword(e.target.value);
                  setError(null);
                }}
                placeholder="Clave maestra actual"
                className="w-full px-4 py-3 pr-12 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
                autoComplete="off"
              />
              <button
                type="button"
                onClick={() => setShowMasterPassword((visible) => !visible)}
                className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                aria-label={showMasterPassword ? "Ocultar clave maestra" : "Mostrar clave maestra"}
              >
                {showMasterPassword ? (
                  <EyeOff className="h-5 w-5" />
                ) : (
                  <Eye className="h-5 w-5" />
                )}
              </button>
            </div>
          )}

          {error && (
            <p className="text-destructive text-sm text-center">{error}</p>
          )}

          <button
            type="submit"
            disabled={
              loading ||
              !username ||
              !password ||
              (hasAdminUsers === false && (!nombre || !masterPassword))
            }
            className="w-full py-3 bg-primary text-primary-foreground rounded-xl font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {loading ? "Entrando..." : hasAdminUsers === false ? "Crear primer admin" : "Entrar"}
          </button>
        </form>
      </div>
    </main>
  );
}
