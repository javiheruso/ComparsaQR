import { db } from "@/lib/db";
import { hasScannerAccess, getPuntoPermiso, getOperador, getPuntoVentaId } from "@/lib/auth";
import { consumoSchema } from "@/lib/schemas";
import { apiError, apiSuccess } from "@/lib/api-error";
import { isGuestId, chargeGuest, getGuestProfile, GUEST_ID_CONST } from "@/lib/guest-store";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await hasScannerAccess())) {
    return apiError("Dispositivo no verificado", 401);
  }

  const permiso = await getPuntoPermiso();
  if (permiso && permiso !== "admin" && permiso !== "barra") {
    return apiError("Este punto no tiene permiso para cobrar", 403);
  }

  const { id } = await params;
  const socioId = parseInt(id);

  if (Number.isNaN(socioId)) {
    return apiError("Socio no válido", 400);
  }

  const body = await request.json().catch(() => null);
  const parsed = consumoSchema.safeParse(body);

  if (!parsed.success) {
    return apiError("Datos de consumo no válidos", 400, parsed.error.issues);
  }

  const productoIds = parsed.data.items.map((item) => item.productoId);
  const productos = await db.producto.findMany({
    where: { id: { in: productoIds } },
    select: { id: true, nombre: true, precio: true },
  });
  const productosPorId = new Map(productos.map((producto) => [producto.id, producto]));

  if (productos.length !== new Set(productoIds).size) {
    return apiError("Producto no encontrado", 400);
  }

  const total = parsed.data.items.reduce((sum, item) => {
    const producto = productosPorId.get(item.productoId);
    return sum + (producto?.precio ?? 0) * item.cantidad;
  }, 0);

  if (total <= 0) {
    return apiError("Importe no válido", 400);
  }

  const descripcion = parsed.data.items
    .map((item) => {
      const producto = productosPorId.get(item.productoId);
      return `${producto?.nombre} x${item.cantidad}`;
    })
    .join(", ");

  // ─── Invitado: cobro en memoria ─────────────────────
  if (isGuestId(socioId)) {
    const guest = getGuestProfile();
    if (guest.credito < total) {
      return apiError("Crédito insuficiente", 400, { creditoActual: guest.credito });
    }

    const ok = chargeGuest(total);
    if (!ok) {
      return apiError("No se pudo completar el cobro.", 409);
    }

    return apiSuccess({
      id: GUEST_ID_CONST,
      nombre: "Invitado",
      numeroSocio: "I-001",
      credito: guest.credito - total,
      estadoPulsera: "activa",
    });
  }

  // ─── Socio normal: cobro en BD ──────────────────────
  const socio = await db.socio.findUnique({
    where: { id: socioId },
  });

  if (!socio) {
    return apiError("Socio no encontrado", 404);
  }

  if (socio.estadoPulsera !== "activa") {
    return apiError("Pulsera desactivada", 403);
  }

  if (socio.credito < total) {
    return apiError("Crédito insuficiente", 400, { creditoActual: socio.credito });
  }

  const updated = await db.$transaction(async (tx) => {
    const update = await tx.socio.updateMany({
      where: {
        id: socioId,
        estadoPulsera: "activa",
        credito: { gte: total },
      },
      data: { credito: { decrement: total } },
    });

    if (update.count !== 1) return null;

    await tx.transaccion.create({
      data: {
        socioId,
        tipo: "consumo" as const,
        cantidad: total,
        descripcion,
        operador: await getOperador(),
        puntoVentaId: await getPuntoVentaId(),
      },
    });

    return tx.socio.findUnique({ where: { id: socioId } });
  });

  if (!updated) {
    return apiError("No se pudo completar el cobro. Revisa el crédito o el estado de la pulsera.", 409);
  }

  return apiSuccess(updated);
}
