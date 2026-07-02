import { login } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { apiError, apiSuccess } from "@/lib/api-error";

function shouldUseSecureCookie(request: Request) {
  const forwardedProtocol = request.headers.get("x-forwarded-proto");
  const protocol = forwardedProtocol ?? new URL(request.url).protocol.replace(":", "");

  return protocol === "https";
}

export async function POST(request: Request) {
  try {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
    const rateCheck = checkRateLimit(`login:${ip}`);
    if (!rateCheck.allowed) {
      return apiError("Demasiados intentos. Intenta de nuevo en 1 minuto.", 429);
    }

    const { password } = await request.json();

    if (!password) {
      return apiError("Contraseña requerida", 400);
    }

    const success = await login(password, shouldUseSecureCookie(request));

    if (!success) {
      return apiError("Contraseña incorrecta", 401);
    }

    return apiSuccess({ success: true });
  } catch {
    return apiError("Error interno", 500);
  }
}
