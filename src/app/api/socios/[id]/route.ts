import { db } from "@/lib/db";
import { getOperador, getSession } from "@/lib/auth";
import { updateSocioSchema } from "@/lib/schemas";
import { apiError, apiSuccess, handleApiError } from "@/lib/api-error";
import {
  matchesConfirmation,
  QR_DELETE_CONFIRMATION_TEXT,
  qrDangerousActionSchema,
} from "@/lib/qr-token-protection";

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

  const socio = await db.socio.findUnique({
    where: { id: socioId },
  });

  if (!socio) {
    return apiError("Socio no encontrado", 404);
  }

  return apiSuccess(socio);
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return apiError("No autorizado", 401);
  }

  try {
    const { id } = await params;
    const socioId = parseInt(id);
    if (Number.isNaN(socioId)) {
      return apiError("ID de socio no válido", 400);
    }

    const body = await request.json();
    const data = updateSocioSchema.parse(body);

    const socio = await db.socio.update({
      where: { id: socioId },
      data: {
        nombre: data.nombre,
        numeroSocio: data.numeroSocio,
        apellido1: data.apellido1 ?? null,
        apellido2: data.apellido2 ?? null,
        dni: data.dni || null,
        tipoVinculacion: data.tipoVinculacion as any ?? null,
        fechaNacimiento: data.fechaNacimiento ? new Date(data.fechaNacimiento) : data.fechaNacimiento === null ? null : undefined,
      },
    });

    return apiSuccess(socio);
  } catch (err) {
    return handleApiError(err, "Error al actualizar socio");
  }
}

export async function DELETE(
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

  if (!matchesConfirmation(QR_DELETE_CONFIRMATION_TEXT, parsed.data.confirmationText)) {
    return apiError(`Escribe exactamente \"${QR_DELETE_CONFIRMATION_TEXT}\" para continuar`, 400);
  }

  const socio = await db.socio.findUnique({ where: { id: socioId } });
  if (!socio) {
    return apiError("Socio no encontrado", 404);
  }

  if (parsed.data.currentToken !== socio.qrToken) {
    return apiError("El QR ha cambiado desde que abriste esta ficha. Recarga antes de continuar.", 409);
  }

  const actor = await getOperador();

  await db.$transaction(async (tx) => {
    await tx.qrTokenAudit.create({
      data: {
        socioId,
        action: "deleted",
        oldQrToken: socio.qrToken,
        newQrToken: null,
        actor,
      },
    });

    await tx.socio.delete({ where: { id: socioId } });
  });

  return apiSuccess({ success: true });
}
