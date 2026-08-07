import { loginAdminUser } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { apiError, apiSuccess } from "@/lib/api-error";
import { loginSchema } from "@/lib/schemas";

function shouldUseSecureCookie(request: Request) {
  const forwardedProtocol = request.headers.get("x-forwarded-proto");
  const protocol = forwardedProtocol ?? new URL(request.url).protocol.replace(":", "");

  return protocol === "https";
}

export async function POST(request: Request) {
  try {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
    const rateCheck = await checkRateLimit(`login:${ip}`);
    if (!rateCheck.allowed) {
      return apiError("Demasiados intentos. Intenta de nuevo en 1 minuto.", 429);
    }

    const body = await request.json();
    const { username, password } = loginSchema.parse(body);

    if (!username) {
      return apiError("Usuario requerido", 400);
    }

    const tipo = await loginAdminUser({ username, password, secureCookie: shouldUseSecureCookie(request) });

    if (!tipo) {
      return apiError("Usuario o contraseña incorrectos", 401);
    }

    return apiSuccess({ success: true, tipo });
  } catch {
    return apiError("Error interno", 500);
  }
}
