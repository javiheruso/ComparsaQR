import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;
  const transacciones = await db.transaccion.findMany({
    where: { socioId: parseInt(id) },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return Response.json(transacciones);
}
