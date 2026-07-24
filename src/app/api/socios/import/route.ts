import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { NextRequest } from "next/server";
import { z } from "zod";

const importSocioSchema = z.object({
  nombre: z.string().min(1).max(100).transform((s) => s.trim()),
  credito: z.number().min(0).optional(),
});

const importBatchSchema = z.object({
  socios: z.array(importSocioSchema).min(1).max(500),
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

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { socios } = importBatchSchema.parse(body);

    let creados = 0;
    let actualizados = 0;
    const errores: { nombre: string; error: string }[] = [];
    const detalles: { nombre: string; accion: "creado" | "actualizado" }[] = [];

    for (const socio of socios) {
      try {
        const existente = await db.socio.findFirst({
          where: { nombre: { equals: socio.nombre, mode: "insensitive" } },
        });

        if (existente) {
          actualizados++;
          detalles.push({ nombre: socio.nombre, accion: "actualizado" });
        } else {
          const numeroSocio = await generarNumeroSocio();
          await db.socio.create({
            data: {
              numeroSocio,
              nombre: socio.nombre,
              credito: socio.credito ?? 0,
            },
          });
          creados++;
          detalles.push({ nombre: socio.nombre, accion: "creado" });
        }
      } catch (err) {
        errores.push({
          nombre: socio.nombre,
          error: err instanceof Error ? err.message : "Error al procesar",
        });
      }
    }

    return Response.json({ creados, actualizados, errores, detalles }, { status: 200 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return Response.json({ error: "Datos inválidos", details: err.issues }, { status: 400 });
    }
    return Response.json({ error: "Error al importar socios" }, { status: 500 });
  }
}
