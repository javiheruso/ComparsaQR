import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { randomUUID } from "crypto";
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
  const socio = await db.socio.findUnique({
    where: { id: parseInt(id) },
  });

  if (!socio) {
    return apiError("Socio no encontrado", 404);
  }

  const updated = await db.socio.update({
    where: { id: parseInt(id) },
    data: {
      qrToken: randomUUID(),
      estadoPulsera: "perdida" as const,
    },
  });

  return apiSuccess(updated);
}
