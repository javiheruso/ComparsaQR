import { db } from "@/lib/db";
import { getSession, getOperador, getPuntoVentaId } from "@/lib/auth";
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

    const operador = await getOperador();
    const puntoVentaId = await getPuntoVentaId();
    const esInicial = data.noRetornable === true;
    const descripcion = data.descripcion || (esInicial
      ? `Recarga inicial (no retornable): ${data.tipoVinculacion}`
      : `Recarga masiva: ${data.tipoVinculacion}`);

    const result = await db.$transaction(async (tx) => {
      const updateData = esInicial
        ? { credito: { increment: data.cantidad }, creditoNoRetornable: { increment: data.cantidad } }
        : { credito: { increment: data.cantidad } };

      await tx.socio.updateMany({
        where: { tipoVinculacion: data.tipoVinculacion as any },
        data: updateData,
      });

      const sociosActualizados = await tx.socio.findMany({
        where: { tipoVinculacion: data.tipoVinculacion as any },
        select: { id: true },
      });

      if (sociosActualizados.length > 0) {
        await tx.transaccion.createMany({
          data: sociosActualizados.map((s) => ({
            socioId: s.id,
            tipo: "carga" as const,
            cantidad: data.cantidad,
            descripcion,
            operador,
            puntoVentaId,
          })),
        });
      }

      return { procesados: sociosActualizados.length };
    });

    return apiSuccess({ procesados: result.procesados, cantidad: data.cantidad });
  } catch (err) {
    return handleApiError(err, "Error al recargar");
  }
}
