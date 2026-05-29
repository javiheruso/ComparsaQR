import { db } from "@/lib/db";
import { hasScannerAccess } from "@/lib/auth";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  if (!(await hasScannerAccess())) {
    return Response.json({ error: "Dispositivo no verificado" }, { status: 401 });
  }

  const { token } = await params;
  const qrToken = token.trim();

  if (!qrToken || qrToken.length > 200) {
    return Response.json({ error: "QR no válido" }, { status: 400 });
  }

  const socio = await db.socio.findUnique({
    where: { qrToken },
    select: {
      id: true,
      nombre: true,
      numeroSocio: true,
      credito: true,
      estadoPulsera: true,
    },
  });

  if (!socio) {
    return Response.json({ error: "QR no válido" }, { status: 404 });
  }

  return Response.json(socio);
}
