import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { productoSchema } from "@/lib/schemas";
import { apiError, apiSuccess, handleApiError } from "@/lib/api-error";

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
    const productoId = parseInt(id);
    if (Number.isNaN(productoId)) {
      return apiError("ID de producto no válido", 400);
    }

    const body = await request.json();
    const data = productoSchema.parse(body);
    const producto = await db.producto.update({
      where: { id: productoId },
      data,
    });
    return apiSuccess(producto);
  } catch (err) {
    return handleApiError(err, "Error al actualizar producto");
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return apiError("No autorizado", 401);
  }

  try {
    const { id } = await params;
    const productoId = parseInt(id);
    if (Number.isNaN(productoId)) {
      return apiError("ID de producto no válido", 400);
    }

    await db.producto.delete({ where: { id: productoId } });
    return apiSuccess({ success: true });
  } catch {
    return apiError("Error al eliminar producto", 500);
  }
}
