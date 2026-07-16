import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { apiError, apiSuccess } from "@/lib/api-error";

export async function GET() {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return apiError("No autorizado", 401);
  }

  const transacciones = await db.transaccion.findMany({
    take: 200,
    orderBy: { createdAt: "desc" },
    include: {
      socio: { select: { nombre: true, numeroSocio: true } },
      puntoVenta: { select: { nombre: true } },
    },
  });

  return apiSuccess(transacciones);
}
