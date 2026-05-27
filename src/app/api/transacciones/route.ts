import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function GET() {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }

  const transacciones = await db.transaccion.findMany({
    take: 200,
    orderBy: { createdAt: "desc" },
    include: {
      socio: { select: { nombre: true, numeroSocio: true } },
    },
  });

  return Response.json(transacciones);
}
