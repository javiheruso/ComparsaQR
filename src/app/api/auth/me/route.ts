import { getSession, getOperador, getPuntoPermiso } from "@/lib/auth";
import { apiError, apiSuccess } from "@/lib/api-error";
import { canAccessAdmin } from "@/lib/access";

export async function GET() {
  const session = await getSession();

  if (!session.actorType && !session.isLoggedIn && !session.scannerVerified) {
    return apiError("No autenticado", 401);
  }

  if (!canAccessAdmin(session)) {
    return apiError("No autorizado", 403);
  }

  const nombre = await getOperador();
  const permiso = await getPuntoPermiso();

  return apiSuccess({
    authenticated: true,
    tipo: "admin",
    nombre,
    permiso,
    puntoNombre: session.puntoNombre ?? null,
  });
}
