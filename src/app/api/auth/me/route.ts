import { getSession, getOperador, getPuntoPermiso } from "@/lib/auth";
import { apiError, apiSuccess } from "@/lib/api-error";

export async function GET() {
  const session = await getSession();
  const autenticado = Boolean(session.isLoggedIn || session.scannerVerified);

  if (!autenticado) {
    return apiError("No autenticado", 401);
  }

  const tipo = session.isLoggedIn ? "admin" : session.puntoNombre ? "punto" : "scanner";
  const nombre = await getOperador();
  const permiso = await getPuntoPermiso();

  return apiSuccess({
    authenticated: true,
    tipo,
    nombre,
    permiso,
    puntoNombre: session.puntoNombre ?? null,
  });
}
