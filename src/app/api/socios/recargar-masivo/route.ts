import { db } from "@/lib/db";
import { getSession, getOperador } from "@/lib/auth";
import { recargaMasivaSchema } from "@/lib/schemas";
import { apiError, apiSuccess, handleApiError } from "@/lib/api-error";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return apiError("No autorizado", 401);
  }

  try {
    const body = await request.json();
    const data = recargaMasivaSchema.parse(body);

    const socios = await db.socio.findMany({
      where: { tipoVinculacion: data.tipoVinculacion as any },
    });

    let procesados = 0;
    for (const socio of socios) {
      await db.$transaction([
        db.socio.update({
          where: { id: socio.id },
          data: { credito: { increment: data.cantidad } },
        }),
        db.transaccion.create({
          data: {
            socioId: socio.id,
            tipo: "carga",
            cantidad: data.cantidad,
            descripcion: data.descripcion || `Recarga masiva: ${data.tipoVinculacion}`,
            operador: await getOperador(),
          },
        }),
      ]);
      procesados++;
    }

    return apiSuccess({ procesados, cantidad: data.cantidad });
  } catch (err) {
    return handleApiError(err, "Error al recargar");
  }
}
