import { db } from "@/lib/db";
import { hasScannerAccess } from "@/lib/auth";
import { apiError, apiSuccess } from "@/lib/api-error";
import { isGuestToken, getGuestProfile } from "@/lib/guest-store";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  if (!(await hasScannerAccess())) {
    return apiError("Dispositivo no verificado", 401);
  }

  const { token } = await params;
  const qrToken = token.trim();

  if (!qrToken || qrToken.length > 200) {
    return apiError("QR no válido", 400);
  }

  if (isGuestToken(qrToken)) {
    return apiSuccess(getGuestProfile());
  }

  const socio = await db.socio.findUnique({
    where: { qrToken },
    select: {
      id: true,
      nombre: true,
      numeroSocio: true,
      credito: true,
      estadoPulsera: true,
      fechaNacimiento: true,
    },
  });

  if (!socio) {
    return apiError("QR no válido", 404);
  }

  return apiSuccess(socio);
}
