import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { apiError, apiSuccess, handleApiError } from "@/lib/api-error";
import { z } from "zod";
import bcrypt from "bcryptjs";

const updatePuntoSchema = z.object({
  nombre: z.string().min(1).max(50).optional(),
  password: z.string().min(4).max(100).optional(),
  permiso: z.enum(["barra", "caja"]).optional(),
  activo: z.boolean().optional(),
});

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return apiError("No autorizado", 401);
  }

  try {
    const { id } = await params;
    const puntoId = parseInt(id);
    if (Number.isNaN(puntoId)) {
      return apiError("ID de punto no válido", 400);
    }

    const body = await request.json();
    const data = updatePuntoSchema.parse(body);

    const updateData: Record<string, unknown> = {};
    if (data.nombre !== undefined) updateData.nombre = data.nombre;
    if (data.permiso !== undefined) updateData.permiso = data.permiso;
    if (data.activo !== undefined) updateData.activo = data.activo;
    if (data.password !== undefined) {
      updateData.password = data.password.startsWith("$2")
        ? data.password
        : await bcrypt.hash(data.password, 10);
    }

    await db.puntoVenta.update({
      where: { id: puntoId },
      data: updateData,
    });

    return apiSuccess({ success: true });
  } catch (err) {
    return handleApiError(err, "Error al actualizar punto");
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return apiError("No autorizado", 401);
  }

  try {
    const { id } = await params;
    const puntoId = parseInt(id);
    if (Number.isNaN(puntoId)) {
      return apiError("ID de punto no válido", 400);
    }

    await db.puntoVenta.delete({ where: { id: puntoId } });
    return apiSuccess({ success: true });
  } catch {
    return apiError("Error al eliminar punto", 500);
  }
}
