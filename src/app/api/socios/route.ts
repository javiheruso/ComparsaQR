import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { NextRequest } from "next/server";
import { z } from "zod";

const createSocioSchema = z.object({
  nombre: z.string().min(1).max(100),
  apellido1: z.string().max(100).optional(),
  apellido2: z.string().max(100).optional(),
  credito: z.number().min(0).default(0),
});

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
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const search = searchParams.get("search") || "";
  const estado = searchParams.get("estado") || "";
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "50");
  const skip = (page - 1) * limit;

  const where = {
    ...(search
      ? {
          OR: [
            { nombre: { contains: search, mode: "insensitive" as const } },
            { numeroSocio: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {}),
    ...(estado ? { estadoPulsera: estado } : {}),
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

  return Response.json({ socios, total, page, totalPages: Math.ceil(total / limit) });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return Response.json({ error: "No autorizado" }, { status: 401 });
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
        credito: data.credito,
      },
    });

    return Response.json(socio, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return Response.json({ error: "Datos inválidos", details: err.issues }, { status: 400 });
    }
    return Response.json({ error: "Error al crear socio" }, { status: 500 });
  }
}
