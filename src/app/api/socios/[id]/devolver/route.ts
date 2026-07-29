import { getSession } from "@/lib/auth";
import { devolucionSchema } from "@/lib/schemas";
import { apiError, apiSuccess, handleApiError } from "@/lib/api-error";
import { requireAccess } from "@/lib/access";
import { MoneyCommandError, refundMember } from "@/lib/money-commands";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  const access = requireAccess(session, {
    allowRoles: ["admin"],
    unauthenticatedMessage: "No autorizado",
    forbiddenMessage: "No tienes permiso para realizar devoluciones",
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
    const { cantidad } = devolucionSchema.parse(body);

    const result = await refundMember({
      socioId: socioIdNum,
      cantidad,
      session,
      idempotencyKey: request.headers.get("x-idempotency-key"),
    });

    return apiSuccess(result.body, result.statusCode);
  } catch (err) {
    if (err instanceof MoneyCommandError) {
      return apiError(err.message, err.statusCode, err.details);
    }

    return handleApiError(err, "Error al devolver crédito");
  }
}
