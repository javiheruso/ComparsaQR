import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { z } from "zod";

const schema = z.object({
  tipoVinculacion: z.string().min(1),
  cantidad: z.number().positive(),
  descripcion: z.string().optional(),
});

export async function POST(request: Request) {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const data = schema.parse(body);

    const socios = await db.socio.findMany({
      where: { tipoVinculacion: data.tipoVinculacion },
    });

    let procesados = 0;
    for (const socio of socios) {
      await db.$transaction([
        db.socio.update({
          where: { id: socio.id },
          data: { credito: { increment: data.cantidad } },
        }),
        db.transaccion.create({
          data: {
            socioId: socio.id,
            tipo: "carga",
            cantidad: data.cantidad,
            descripcion: data.descripcion || `Recarga masiva: ${data.tipoVinculacion}`,
          },
        }),
      ]);
      procesados++;
    }

    return Response.json({ procesados, cantidad: data.cantidad });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return Response.json({ error: "Datos inválidos", details: err.issues }, { status: 400 });
    }
    return Response.json({ error: "Error al recargar" }, { status: 500 });
  }
}
