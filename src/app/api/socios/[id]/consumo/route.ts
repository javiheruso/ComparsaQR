import { getSession } from "@/lib/auth";
import { consumoSchema } from "@/lib/schemas";
import { apiError, apiSuccess, handleApiError } from "@/lib/api-error";
import { requireAccess } from "@/lib/access";
import { chargeMember, MoneyCommandError } from "@/lib/money-commands";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  const access = requireAccess(session, {
    allowRoles: ["admin", "scanner", "punto"],
    allowedPuntoPermissions: ["barra"],
    unauthenticatedMessage: "Dispositivo no verificado",
    forbiddenMessage: "Este punto no tiene permiso para cobrar",
  });

  if (!access.ok) {
    return apiError(access.message, access.status);
  }

  const { id } = await params;
  const socioId = parseInt(id);

  if (Number.isNaN(socioId)) {
    return apiError("Socio no válido", 400);
  }

  const body = await request.json().catch(() => null);
  const parsed = consumoSchema.safeParse(body);

  if (!parsed.success) {
    return apiError("Datos de consumo no válidos", 400, parsed.error.issues);
  }

  try {
    const result = await chargeMember({
      socioId,
      items: parsed.data.items,
      session,
      idempotencyKey: request.headers.get("x-idempotency-key"),
    });

    return apiSuccess(result.body, result.statusCode);
  } catch (err) {
    if (err instanceof MoneyCommandError) {
      return apiError(err.message, err.statusCode, err.details);
    }

    return handleApiError(err, "Error al cobrar consumo");
  }
}
