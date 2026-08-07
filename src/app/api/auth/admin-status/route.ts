import { apiSuccess } from "@/lib/api-error";
import { hasAdminUsers } from "@/lib/admin-users";

export async function GET() {
  return apiSuccess({ hasAdminUsers: await hasAdminUsers() });
}
