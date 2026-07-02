import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { updateSocioSchema } from "@/lib/schemas";
import { apiError, apiSuccess, handleApiError } from "@/lib/api-error";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return apiError("No autorizado", 401);
  }

  const { id } = await params;
  const socio = await db.socio.findUnique({
    where: { id: parseInt(id) },
  });

  if (!socio) {
    return apiError("Socio no encontrado", 404);
  }

  return apiSuccess(socio);
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return apiError("No autorizado", 401);
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const data = updateSocioSchema.parse(body);

    const socio = await db.socio.update({
      where: { id: parseInt(id) },
      data: {
        nombre: data.nombre,
        numeroSocio: data.numeroSocio,
        apellido1: data.apellido1 ?? null,
        apellido2: data.apellido2 ?? null,
        dni: data.dni || null,
        tipoVinculacion: data.tipoVinculacion as any ?? null,
        fechaNacimiento: data.fechaNacimiento ? new Date(data.fechaNacimiento) : data.fechaNacimiento === null ? null : undefined,
      },
    });

    return apiSuccess(socio);
  } catch (err) {
    return handleApiError(err, "Error al actualizar socio");
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return apiError("No autorizado", 401);
  }

  const { id } = await params;
  // Cascade delete handles Transaccion cleanup
  await db.socio.delete({ where: { id: parseInt(id) } });

  return apiSuccess({ success: true });
}
