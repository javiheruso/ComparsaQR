import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { apiError, apiSuccess } from "@/lib/api-error";

export async function PATCH(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return apiError("No autorizado", 401);
  }

  const { id } = await params;
  const socioId = parseInt(id);
  if (Number.isNaN(socioId)) {
    return apiError("ID de socio no válido", 400);
  }

  const socio = await db.socio.findUnique({
    where: { id: socioId },
  });

  if (!socio) {
    return apiError("Socio no encontrado", 404);
  }

  const nuevoEstado = socio.estadoPulsera === "activa" ? "inactiva" as const : "activa" as const;
  const updated = await db.socio.update({
    where: { id: socioId },
    data: { estadoPulsera: nuevoEstado },
  });

  return apiSuccess(updated);
}
