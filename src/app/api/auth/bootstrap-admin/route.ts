import { bootstrapAdminUser } from "@/lib/auth";
import { apiError, apiSuccess, handleApiError } from "@/lib/api-error";
import { adminBootstrapSchema } from "@/lib/schemas";
import { hasAdminUsers } from "@/lib/admin-users";

function shouldUseSecureCookie(request: Request) {
  const forwardedProtocol = request.headers.get("x-forwarded-proto");
  const protocol = forwardedProtocol ?? new URL(request.url).protocol.replace(":", "");

  return protocol === "https";
}

export async function POST(request: Request) {
  try {
    if (await hasAdminUsers()) {
      return apiError("La inicialización ya se ha completado", 409);
    }

    const body = await request.json();
    const data = adminBootstrapSchema.parse(body);

    const result = await bootstrapAdminUser({
      ...data,
      secureCookie: shouldUseSecureCookie(request),
    });

    if (!result) {
      return apiError("Clave maestra incorrecta", 401);
    }

    return apiSuccess({ success: true, tipo: result });
  } catch (err) {
    return handleApiError(err, "Error al inicializar administradores");
  }
}
