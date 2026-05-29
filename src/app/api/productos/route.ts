import { db } from "@/lib/db";
import { getSession, hasScannerAccess } from "@/lib/auth";
import { z } from "zod";

const productoSchema = z.object({
  nombre: z.string().min(1).max(100),
  precio: z.number().min(0),
  imagen: z.string().max(500).default(""),
});

export async function GET() {
  if (!(await hasScannerAccess())) {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }

  const productos = await db.producto.findMany({
    orderBy: { nombre: "asc" },
  });
  return Response.json(productos);
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const data = productoSchema.parse(body);
    const producto = await db.producto.create({ data });
    return Response.json(producto, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return Response.json({ error: "Datos inválidos", details: err.issues }, { status: 400 });
    }
    return Response.json({ error: "Error al crear producto" }, { status: 500 });
  }
}
