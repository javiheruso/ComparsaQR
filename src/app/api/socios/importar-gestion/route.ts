import { getSession } from "@/lib/auth";
import { apiError, apiSuccess } from "@/lib/api-error";
import { db } from "@/lib/db";
import { importGestionRows, type GestionImportRow } from "@/lib/batch-sync";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return apiError("No autorizado", 401);
  }

  try {
    const rows: GestionImportRow[] = await request.json();
    const result = await importGestionRows({
      batchKey: request.headers.get("x-idempotency-key"),
      rows,
      client: db as never,
    });

    return apiSuccess(result);
  } catch {
    return apiError("Error al procesar importación", 500);
  }
}
