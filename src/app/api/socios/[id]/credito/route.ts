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
    const body = await request.json();
    const { cantidad, descripcion } = creditoSchema.parse(body);

    const socio = await db.socio.findUnique({ where: { id: parseInt(id) } });

    if (!socio) {
      return apiError("Socio no encontrado", 404);
    }

    const [updated] = await Promise.all([
      db.socio.update({
        where: { id: parseInt(id) },
        data: { credito: { increment: cantidad } },
      }),
      db.transaccion.create({
        data: {
          socioId: parseInt(id),
          tipo: "carga",
          cantidad,
          descripcion: descripcion ?? null,
          operador: await getOperador(),
          puntoVentaId: await getPuntoVentaId(),
        },
      }),
    ]);

    return apiSuccess(updated);
  } catch (err) {
    return handleApiError(err, "Error al cargar crédito");
  }
}
