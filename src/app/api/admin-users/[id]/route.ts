import bcrypt from "bcryptjs";

import { getSession } from "@/lib/auth";
import { apiError, apiSuccess, handleApiError } from "@/lib/api-error";
import { db } from "@/lib/db";
import { adminUserUpdateSchema } from "@/lib/schemas";
import { logAdminAction } from "@/lib/admin-audit";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return apiError("No autorizado", 401);
  }

  try {
    const { id } = await params;
    const adminUserId = Number.parseInt(id, 10);
    if (Number.isNaN(adminUserId)) {
      return apiError("ID de usuario no válido", 400);
    }

    const body = await request.json();
    const data = adminUserUpdateSchema.parse(body);

    const current = await db.adminUser.findUnique({ where: { id: adminUserId } });
    if (!current) {
      return apiError("Usuario administrador no encontrado", 404);
    }

    const updateData: Record<string, unknown> = {};
    if (data.nombre !== undefined) updateData.nombre = data.nombre.trim();
    if (data.activo !== undefined) updateData.activo = data.activo;
    if (data.password !== undefined) updateData.passwordHash = await bcrypt.hash(data.password, 10);

    const updated = await db.adminUser.update({
      where: { id: adminUserId },
      data: updateData,
    });

    await logAdminAction({
      session,
      action: "admin_user_updated",
      targetType: "admin_user",
      targetId: String(updated.id),
      summary: `Actualizado usuario admin ${updated.username}`,
      details: {
        changedName: data.nombre !== undefined,
        changedPassword: data.password !== undefined,
        activo: data.activo,
      },
    });

    return apiSuccess({
      id: updated.id,
      username: updated.username,
      nombre: updated.nombre,
      activo: updated.activo,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    });
  } catch (err) {
    return handleApiError(err, "Error al actualizar usuario administrador");
  }
}
