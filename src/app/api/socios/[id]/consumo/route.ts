import { db } from "@/lib/db";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { cantidad, descripcion } = await request.json();

  const socio = await db.socio.findUnique({
    where: { id: parseInt(id) },
  });

  if (!socio) {
    return Response.json({ error: "Socio no encontrado" }, { status: 404 });
  }

  if (socio.estadoPulsera !== "activa") {
    return Response.json(
      { error: "Pulsera desactivada" },
      { status: 403 }
    );
  }

  if (socio.credito < cantidad) {
    return Response.json(
      { error: "Crédito insuficiente", creditoActual: socio.credito },
      { status: 400 }
    );
  }

  const updated = await db.socio.update({
    where: { id: parseInt(id) },
    data: { credito: { decrement: cantidad } },
  });

  await db.transaccion.create({
    data: {
      socioId: parseInt(id),
      tipo: "consumo",
      cantidad,
      descripcion: descripcion ?? null,
    },
  });

  return Response.json(updated);
}
