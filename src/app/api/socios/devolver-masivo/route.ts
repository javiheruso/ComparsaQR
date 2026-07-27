import { db } from "@/lib/db";
import { getSession, getOperador, getPuntoVentaId, getPuntoPermiso } from "@/lib/auth";
import { devolucionMasivaSchema } from "@/lib/schemas";
import { apiError, apiSuccess, handleApiError } from "@/lib/api-error";

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

    const where = data.socioIds ? { id: { in: data.socioIds } } : {};
    const socios = await db.socio.findMany({
      where,
      select: { id: true, credito: true, creditoNoRetornable: true },
    });

    const operador = await getOperador();
    const puntoVentaId = await getPuntoVentaId();
    let devueltos = 0;
    let totalDevuelto = 0;

    for (const socio of socios) {
      const retornable = Math.max(0, socio.credito - socio.creditoNoRetornable);
      if (retornable <= 0) continue;

      await db.$transaction(async (tx) => {
        await tx.socio.update({
          where: { id: socio.id },
          data: { credito: { decrement: retornable } },
        });
        await tx.transaccion.create({
          data: {
            socioId: socio.id,
            tipo: "devolucion",
            cantidad: retornable,
            descripcion: "Devolución masiva de crédito retornable",
            operador,
            puntoVentaId,
          },
        });
      });

      devueltos++;
      totalDevuelto += retornable;
    }

    return apiSuccess({ procesados: devueltos, totalDevuelto });
  } catch (err) {
    return handleApiError(err, "Error al realizar devolución masiva");
  }
}
