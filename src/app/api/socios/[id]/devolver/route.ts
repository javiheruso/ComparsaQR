import { db } from "@/lib/db";
import { getSession, getOperador, getPuntoVentaId, getPuntoPermiso } from "@/lib/auth";
import { devolucionSchema } from "@/lib/schemas";
import { apiError, apiSuccess, handleApiError } from "@/lib/api-error";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return apiError("No autorizado", 401);
  }

  const permiso = await getPuntoPermiso();
  if (permiso && permiso !== "admin") {
    return apiError("No tienes permiso para realizar devoluciones", 403);
  }

  try {
    const { id } = await params;
    const socioIdNum = parseInt(id);
    if (Number.isNaN(socioIdNum)) {
      return apiError("ID de socio no válido", 400);
    }

    const body = await request.json();
    const { cantidad } = devolucionSchema.parse(body);

    const socio = await db.socio.findUnique({ where: { id: socioIdNum } });

    if (!socio) {
      return apiError("Socio no encontrado", 404);
    }

    const retornable = socio.credito - socio.creditoNoRetornable;
    if (cantidad > retornable) {
      return apiError("La cantidad a devolver supera el saldo retornable", 400, {
        retornable,
        credito: socio.credito,
        creditoNoRetornable: socio.creditoNoRetornable,
      });
    }

    const updated = await db.$transaction(async (tx) => {
      const s = await tx.socio.update({
        where: { id: socioIdNum },
        data: { credito: { decrement: cantidad } },
      });
      await tx.transaccion.create({
        data: {
          socioId: socioIdNum,
          tipo: "devolucion",
          cantidad,
          descripcion: "Devolución de crédito retornable",
          operador: await getOperador(),
          puntoVentaId: await getPuntoVentaId(),
        },
      });
      return s;
    });

    return apiSuccess(updated);
  } catch (err) {
    return handleApiError(err, "Error al devolver crédito");
  }
}
