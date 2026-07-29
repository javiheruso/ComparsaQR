import { getSession } from "@/lib/auth";
import { creditoSchema } from "@/lib/schemas";
import { apiError, apiSuccess, handleApiError } from "@/lib/api-error";
import { requireAccess } from "@/lib/access";
import { creditMember, MoneyCommandError } from "@/lib/money-commands";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  const access = requireAccess(session, {
    allowRoles: ["admin", "punto"],
    allowedPuntoPermissions: ["caja"],
    unauthenticatedMessage: "No autorizado",
    forbiddenMessage: "Este punto no tiene permiso para recargar",
  });

  if (!access.ok) {
    return apiError(access.message, access.status);
  }

  try {
    const { id } = await params;
    const socioIdNum = parseInt(id);
    if (Number.isNaN(socioIdNum)) {
      return apiError("ID de socio no válido", 400);
    }

    const body = await request.json();
    const { cantidad, descripcion } = creditoSchema.parse(body);

    const result = await creditMember({
      socioId: socioIdNum,
      cantidad,
      descripcion,
      session,
      idempotencyKey: request.headers.get("x-idempotency-key"),
    });

    return apiSuccess(result.body, result.statusCode);
  } catch (err) {
    if (err instanceof MoneyCommandError) {
      return apiError(err.message, err.statusCode, err.details);
    }

    return handleApiError(err, "Error al cargar crédito");
  }
}
