import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;
  const { cantidad, descripcion } = await request.json();

  const [socio] = await Promise.all([
    db.socio.findUnique({ where: { id: parseInt(id) } }),
  ]);

  if (!socio) {
    return Response.json({ error: "Socio no encontrado" }, { status: 404 });
  }

  const [updated] = await Promise.all([
    db.socio.update({
      where: { id: parseInt(id) },
      data: { credito: { increment: cantidad } },
    }),
    db.transaccion.create({
      data: {
        socioId: parseInt(id),
        tipo: "carga",
        cantidad,
        descripcion: descripcion ?? null,
      },
    }),
  ]);

  return Response.json(updated);
}
