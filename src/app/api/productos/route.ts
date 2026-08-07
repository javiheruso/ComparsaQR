import { db } from "@/lib/db";
import { getSession, hasScannerAccess } from "@/lib/auth";
import { productoSchema } from "@/lib/schemas";
import { apiError, apiSuccess, handleApiError } from "@/lib/api-error";
import { serializeProduct, serializeProducts } from "@/lib/product-serialization";

export async function GET() {
  try {
    if (!(await hasScannerAccess())) {
      return apiError("No autorizado", 401);
    }

    const productos = await db.producto.findMany({
      orderBy: { nombre: "asc" },
    });
    return apiSuccess(serializeProducts(productos));
  } catch (err) {
    return handleApiError(err, "Error al cargar productos");
  }
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
    return apiSuccess(serializeProduct(producto), 201);
  } catch (err) {
    return handleApiError(err, "Error al crear producto");
  }
}
