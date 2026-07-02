import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { NextRequest } from "next/server";
import { createSocioSchema } from "@/lib/schemas";
import { apiError, apiSuccess, handleApiError } from "@/lib/api-error";

async function generarNumeroSocio(): Promise<string> {
  const lastSocio = await db.socio.findFirst({
    orderBy: { id: "desc" },
    select: { numeroSocio: true },
  });

  let nextNum = 1;
  if (lastSocio) {
    const match = lastSocio.numeroSocio.match(/s-(\d+)/i);
    if (match) nextNum = parseInt(match[1]) + 1;
  }

  return `s-${String(nextNum).padStart(3, "0")}`;
}

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return apiError("No autorizado", 401);
  }

  const { searchParams } = request.nextUrl;
  const search = searchParams.get("search") || "";
  const estado = searchParams.get("estado") || "";
  const tipo = searchParams.get("tipo") || "";
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "50");
  const skip = (page - 1) * limit;

  const where = {
    ...(search
      ? {
          OR: [
            { nombre: { contains: search, mode: "insensitive" as const } },
            { apellido1: { contains: search, mode: "insensitive" as const } },
            { apellido2: { contains: search, mode: "insensitive" as const } },
            { numeroSocio: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {}),
    ...(estado ? { estadoPulsera: estado as any } : {}),
    ...(tipo ? { tipoVinculacion: tipo as any } : {}),
  };

  const [socios, total] = await Promise.all([
    db.socio.findMany({
      where,
      skip,
      take: limit,
      orderBy: { id: "asc" },
    }),
    db.socio.count({ where }),
  ]);

  return apiSuccess({ socios, total, page, totalPages: Math.ceil(total / limit) });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return apiError("No autorizado", 401);
  }

  try {
    const body = await request.json();
    const data = createSocioSchema.parse(body);
    const numeroSocio = await generarNumeroSocio();

    const socio = await db.socio.create({
      data: {
        numeroSocio,
        nombre: data.nombre,
        apellido1: data.apellido1 ?? null,
        apellido2: data.apellido2 ?? null,
        dni: data.dni || null,
        tipoVinculacion: data.tipoVinculacion as any ?? "socio",
        fechaNacimiento: data.fechaNacimiento ? new Date(data.fechaNacimiento) : null,
        credito: data.credito,
      },
    });

    return apiSuccess(socio, 201);
  } catch (err) {
    return handleApiError(err, "Error al crear socio");
  }
}
