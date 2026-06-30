import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { randomUUID } from "crypto";

export async function PATCH(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;
  const socio = await db.socio.findUnique({
    where: { id: parseInt(id) },
  });

  if (!socio) {
    return Response.json({ error: "Socio no encontrado" }, { status: 404 });
  }

  const updated = await db.socio.update({
    where: { id: parseInt(id) },
    data: {
      qrToken: randomUUID(),
      estadoPulsera: "perdida",
    },
  });

  return Response.json(updated);
}
