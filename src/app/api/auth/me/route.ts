import { getSession } from "@/lib/auth";
import { apiError, apiSuccess } from "@/lib/api-error";

export async function GET() {
  const session = await getSession();

  if (!session.isLoggedIn) {
    return apiError("No autenticado", 401);
  }

  return apiSuccess({ authenticated: true });
}
