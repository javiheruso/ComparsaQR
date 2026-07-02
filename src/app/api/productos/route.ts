import { db } from "@/lib/db";
import { getSession, hasScannerAccess } from "@/lib/auth";
import { productoSchema } from "@/lib/schemas";
import { apiError, apiSuccess, handleApiError } from "@/lib/api-error";

export async function GET() {
  if (!(await hasScannerAccess())) {
    return apiError("No autorizado", 401);
  }

  const productos = await db.producto.findMany({
    orderBy: { nombre: "asc" },
  });
  return apiSuccess(productos);
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return apiError("No autorizado", 401);
  }

  try {
    const body = await request.json();
    const data = productoSchema.parse(body);
    const producto = await db.producto.create({ data });
    return apiSuccess(producto, 201);
  } catch (err) {
    return handleApiError(err, "Error al crear producto");
  }
}
