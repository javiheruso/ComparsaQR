import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { apiError, apiSuccess } from "@/lib/api-error";

export async function GET(
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

  const transacciones = await db.transaccion.findMany({
    where: { socioId },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      puntoVenta: { select: { nombre: true } },
    },
  });

  return apiSuccess(transacciones);
}
