import { getSession, getPuntoPermiso } from "@/lib/auth";
import { devolucionMasivaSchema } from "@/lib/schemas";
import { apiError, apiSuccess, handleApiError } from "@/lib/api-error";
import { db } from "@/lib/db";
import { processMassRefund } from "@/lib/batch-sync";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return apiError("No autorizado", 401);
  }

  const permiso = await getPuntoPermiso();
  if (permiso && permiso !== "admin") {
    return apiError("No tienes permiso para realizar devoluciones", 403);
  }

  try {
    const body = await request.json().catch(() => ({}));
    const data = devolucionMasivaSchema.parse(body);

    const result = await processMassRefund({
      batchKey: request.headers.get("x-idempotency-key"),
      socioIds: data.socioIds,
      session,
      client: db as never,
    });

    return apiSuccess(result);
  } catch (err) {
    return handleApiError(err, "Error al realizar devolución masiva");
  }
}
