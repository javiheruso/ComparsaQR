import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { apiError, apiSuccess, handleApiError } from "@/lib/api-error";
import { z } from "zod";
import bcrypt from "bcryptjs";

const createPuntoSchema = z.object({
  nombre: z.string().min(1).max(50),
  password: z.string().min(4).max(100),
  permiso: z.enum(["barra", "caja"]),
});

export async function GET() {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return apiError("No autorizado", 401);
  }

  const puntos = await db.puntoVenta.findMany({ orderBy: { nombre: "asc" } });
  const sinPasswords = puntos.map((p) => ({
    id: p.id, nombre: p.nombre, permiso: p.permiso, activo: p.activo,
    createdAt: p.createdAt, updatedAt: p.updatedAt,
  }));

  return apiSuccess(sinPasswords);
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return apiError("No autorizado", 401);
  }

  try {
    const body = await request.json();
    const data = createPuntoSchema.parse(body);

    const password = data.password.startsWith("$2")
      ? data.password
      : await bcrypt.hash(data.password, 10);

    const punto = await db.puntoVenta.create({
      data: { nombre: data.nombre, password, permiso: data.permiso },
    });

    return apiSuccess({ id: punto.id, nombre: punto.nombre, permiso: punto.permiso, activo: punto.activo }, 201);
  } catch (err) {
    return handleApiError(err, "Error al crear punto");
  }
}
