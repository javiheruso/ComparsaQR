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
  const socio = await db.socio.findUnique({
    where: { id: parseInt(id) },
  });

  if (!socio) {
    return Response.json({ error: "Socio no encontrado" }, { status: 404 });
  }

  return Response.json(socio);
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();

  const socio = await db.socio.update({
    where: { id: parseInt(id) },
    data: {
      nombre: body.nombre,
      numeroSocio: body.numeroSocio,
      apellido1: body.apellido1 ?? null,
      apellido2: body.apellido2 ?? null,
      tipoVinculacion: body.tipoVinculacion ?? null,
      fechaNacimiento: body.fechaNacimiento ? new Date(body.fechaNacimiento) : body.fechaNacimiento === null ? null : undefined,
    },
  });

  return Response.json(socio);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;
  await db.transaccion.deleteMany({ where: { socioId: parseInt(id) } });
  await db.socio.delete({ where: { id: parseInt(id) } });

  return Response.json({ success: true });
}
