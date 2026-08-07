import { getSession } from "@/lib/auth";
import { apiError, apiSuccess, handleApiError } from "@/lib/api-error";
import { db } from "@/lib/db";
import { adminUserSchema } from "@/lib/schemas";
import { createAdminUser, normalizeUsername } from "@/lib/admin-users";
import { logAdminAction } from "@/lib/admin-audit";

export async function GET() {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return apiError("No autorizado", 401);
  }

  const admins = await db.adminUser.findMany({
    orderBy: { nombre: "asc" },
    select: {
      id: true,
      username: true,
      nombre: true,
      activo: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return apiSuccess(admins);
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return apiError("No autorizado", 401);
  }

  try {
    const body = await request.json();
    const data = adminUserSchema.parse(body);

    const existing = await db.adminUser.findUnique({ where: { username: normalizeUsername(data.username) } });
    if (existing) {
      return apiError("Ese usuario ya existe", 409);
    }

    const adminUser = await createAdminUser(data);

    await logAdminAction({
      session,
      action: "admin_user_created",
      targetType: "admin_user",
      targetId: String(adminUser.id),
      summary: `Creado usuario admin ${adminUser.username}`,
      details: { username: adminUser.username, nombre: adminUser.nombre },
    });

    return apiSuccess({
      id: adminUser.id,
      username: adminUser.username,
      nombre: adminUser.nombre,
      activo: adminUser.activo,
      createdAt: adminUser.createdAt,
      updatedAt: adminUser.updatedAt,
    }, 201);
  } catch (err) {
    return handleApiError(err, "Error al crear usuario administrador");
  }
}
