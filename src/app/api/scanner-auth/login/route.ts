import { verifyScannerDevice } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { apiError, apiSuccess } from "@/lib/api-error";

export async function POST(request: Request) {
  try {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
    const rateCheck = checkRateLimit(`scanner-login:${ip}`);
    if (!rateCheck.allowed) {
      return apiError("Demasiados intentos. Intenta de nuevo en 1 minuto.", 429);
    }

    const { password } = await request.json();

    if (!password) {
      return apiError("Clave requerida", 400);
    }

    const success = await verifyScannerDevice(password);

    if (!success) {
      return apiError("Clave incorrecta", 401);
    }

    return apiSuccess({ success: true });
  } catch {
    return apiError("Error interno", 500);
  }
}
