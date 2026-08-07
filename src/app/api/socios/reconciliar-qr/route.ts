import { getOperador, getSession } from "@/lib/auth";
import { apiError, apiSuccess } from "@/lib/api-error";
import { db } from "@/lib/db";
import { qrDangerousActionSchema } from "@/lib/qr-token-protection";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return apiError("No autorizado", 401);
  }

  const body = await request.json().catch(() => null);
  if (
    typeof body !== "object" ||
    body === null ||
    !("socioId" in body) ||
    typeof body.socioId !== "number"
  ) {
    return apiError("Datos inválidos", 400);
  }

  const tokenCheck = qrDangerousActionSchema.pick({ currentToken: true }).safeParse({
    currentToken: body.currentToken,
  });
  if (!tokenCheck.success) {
    return apiError("Token inválido", 400, tokenCheck.error.issues);
  }

  const socioId = body.socioId;
  const nextToken = tokenCheck.data.currentToken;

  const targetSocio = await db.socio.findUnique({ where: { id: socioId } });
  if (!targetSocio) {
    return apiError("Socio no encontrado", 404);
  }

  const existingOwner = await db.socio.findUnique({ where: { qrToken: nextToken } });
  if (existingOwner && existingOwner.id !== targetSocio.id) {
    return apiError(
      `Ese QR ya pertenece a ${existingOwner.nombre} (#${existingOwner.numeroSocio})`,
      409,
    );
  }

  if (targetSocio.qrToken === nextToken) {
    return apiSuccess(targetSocio);
  }

  const actor = await getOperador();

  const updated = await db.$transaction(async (tx) => {
    const nextSocio = await tx.socio.update({
      where: { id: socioId },
      data: { qrToken: nextToken },
    });

    await tx.qrTokenAudit.create({
      data: {
        socioId,
        action: "reconciled",
        oldQrToken: targetSocio.qrToken,
        newQrToken: nextToken,
        actor,
      },
    });

    return nextSocio;
  });

  return apiSuccess(updated);
}
