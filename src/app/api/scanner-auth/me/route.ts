import { hasScannerAccess } from "@/lib/auth";
import { apiError, apiSuccess } from "@/lib/api-error";

export async function GET() {
  const verified = await hasScannerAccess();

  if (!verified) {
    return apiError("Dispositivo no verificado", 401);
  }

  return apiSuccess({ verified: true });
}
