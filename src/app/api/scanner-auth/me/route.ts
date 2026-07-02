import { hasScannerAccess, getSession, getPuntoPermiso } from "@/lib/auth";
import { apiError, apiSuccess } from "@/lib/api-error";

export async function GET() {
  const verified = await hasScannerAccess();

  if (!verified) {
    return apiError("Dispositivo no verificado", 401);
  }

  const session = await getSession();
  const permiso = await getPuntoPermiso();

  return apiSuccess({
    verified: true,
    tipo: session.isLoggedIn ? "admin" : session.puntoNombre ? "punto" : "scanner",
    permiso,
    puntoNombre: session.puntoNombre ?? null,
  });
}
