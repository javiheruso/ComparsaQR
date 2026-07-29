import { getSession } from "@/lib/auth";
import { recargaMasivaSchema } from "@/lib/schemas";
import { apiError, apiSuccess, handleApiError } from "@/lib/api-error";
import { db } from "@/lib/db";
import { processMassCredit } from "@/lib/batch-sync";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return apiError("No autorizado", 401);
  }

  try {
    const body = await request.json();
    const data = recargaMasivaSchema.parse(body);

    const esInicial = data.noRetornable === true;
    const descripcion = data.descripcion || (esInicial
      ? `Recarga inicial (no retornable): ${data.tipoVinculacion}`
      : `Recarga masiva: ${data.tipoVinculacion}`);

    const result = await processMassCredit({
      batchKey: request.headers.get("x-idempotency-key"),
      tipoVinculacion: data.tipoVinculacion,
      cantidad: data.cantidad,
      descripcion,
      noRetornable: esInicial,
      session,
      client: db as never,
    });

    return apiSuccess(result);
  } catch (err) {
    return handleApiError(err, "Error al recargar");
  }
}
