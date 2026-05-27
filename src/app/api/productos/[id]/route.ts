import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { z } from "zod";

const updateProductoSchema = z.object({
  nombre: z.string().min(1).max(100),
  precio: z.number().min(0),
  imagen: z.string().max(500),
});

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const body = await request.json();
    const data = updateProductoSchema.parse(body);
    const producto = await db.producto.update({
      where: { id: parseInt(id) },
      data,
    });
    return Response.json(producto);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return Response.json({ error: "Datos inválidos", details: err.issues }, { status: 400 });
    }
    return Response.json({ error: "Error al actualizar producto" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;

  try {
    await db.producto.delete({ where: { id: parseInt(id) } });
    return Response.json({ success: true });
  } catch {
    return Response.json({ error: "Error al eliminar producto" }, { status: 500 });
  }
}
