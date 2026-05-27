import { db } from "@/lib/db";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const socio = await db.socio.findUnique({
    where: { qrToken: token },
  });

  if (!socio) {
    return Response.json({ error: "QR no válido" }, { status: 404 });
  }

  return Response.json({
    id: socio.id,
    nombre: socio.nombre,
    numeroSocio: socio.numeroSocio,
    credito: socio.credito,
    estadoPulsera: socio.estadoPulsera,
  });
}
