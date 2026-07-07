import { db } from "@/lib/db";
import { getSession, getOperador, getPuntoPermiso, getPuntoVentaId } from "@/lib/auth";
import { creditoSchema } from "@/lib/schemas";
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
  if (permiso && permiso !== "admin" && permiso !== "caja") {
    return apiError("Este punto no tiene permiso para recargar", 403);
  }

  try {
    const { id } = await params;
    const socioIdNum = parseInt(id);
    if (Number.isNaN(socioIdNum)) {
      return apiError("ID de socio no válido", 400);
    }

    const body = await request.json();
    const { cantidad, descripcion } = creditoSchema.parse(body);

    const socio = await db.socio.findUnique({ where: { id: socioIdNum } });

    if (!socio) {
      return apiError("Socio no encontrado", 404);
    }

    if (socio.estadoPulsera !== "activa") {
      return apiError("No se puede recargar a un socio inactivo", 403);
    }

    const updated = await db.$transaction(async (tx) => {
      const s = await tx.socio.update({
        where: { id: socioIdNum },
        data: { credito: { increment: cantidad } },
      });
      await tx.transaccion.create({
        data: {
          socioId: socioIdNum,
          tipo: "carga",
          cantidad,
          descripcion: descripcion ?? null,
          operador: await getOperador(),
          puntoVentaId: await getPuntoVentaId(),
        },
      });
      return s;
    });

    return apiSuccess(updated);
  } catch (err) {
    return handleApiError(err, "Error al cargar crédito");
  }
}
