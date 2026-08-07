import { db } from "@/lib/db";
import { getOperador, getSession } from "@/lib/auth";
import { randomUUID } from "crypto";
import { apiError, apiSuccess } from "@/lib/api-error";
import {
  matchesConfirmation,
  QR_REGEN_CONFIRMATION_TEXT,
  qrDangerousActionSchema,
} from "@/lib/qr-token-protection";

export async function PATCH(
  request: Request,
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

  const body = await request.json().catch(() => null);
  const parsed = qrDangerousActionSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("Confirmación inválida", 400, parsed.error.issues);
  }

  if (!matchesConfirmation(QR_REGEN_CONFIRMATION_TEXT, parsed.data.confirmationText)) {
    return apiError(`Escribe exactamente \"${QR_REGEN_CONFIRMATION_TEXT}\" para continuar`, 400);
  }

  const socio = await db.socio.findUnique({
    where: { id: socioId },
  });

  if (!socio) {
    return apiError("Socio no encontrado", 404);
  }

  if (parsed.data.currentToken !== socio.qrToken) {
    return apiError("El QR ha cambiado desde que abriste esta ficha. Recarga antes de continuar.", 409);
  }

  const nextQrToken = randomUUID();
  const actor = await getOperador();

  const updated = await db.$transaction(async (tx) => {
    const nextSocio = await tx.socio.update({
      where: { id: socioId },
      data: {
        qrToken: nextQrToken,
        estadoPulsera: "perdida" as const,
      },
    });

    await tx.qrTokenAudit.create({
      data: {
        socioId,
        action: "regenerated",
        oldQrToken: socio.qrToken,
        newQrToken: nextQrToken,
        actor,
      },
    });

    return nextSocio;
  });

  return apiSuccess(updated);
}
