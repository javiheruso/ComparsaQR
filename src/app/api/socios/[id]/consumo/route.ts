import { db } from "@/lib/db";
import { hasScannerAccess } from "@/lib/auth";
import { z } from "zod";

const consumoSchema = z.object({
  items: z
    .array(
      z.object({
        productoId: z.number().int().positive(),
        cantidad: z.number().int().positive().max(99),
      })
    )
    .min(1)
    .max(50),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await hasScannerAccess())) {
    return Response.json({ error: "Dispositivo no verificado" }, { status: 401 });
  }

  const { id } = await params;
  const socioId = parseInt(id);

  if (Number.isNaN(socioId)) {
    return Response.json({ error: "Socio no válido" }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const parsed = consumoSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json(
      { error: "Datos de consumo no válidos", details: parsed.error.issues },
      { status: 400 }
    );
  }

  const socio = await db.socio.findUnique({
    where: { id: socioId },
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

  const productoIds = parsed.data.items.map((item) => item.productoId);
  const productos = await db.producto.findMany({
    where: { id: { in: productoIds } },
    select: { id: true, nombre: true, precio: true },
  });
  const productosPorId = new Map(productos.map((producto) => [producto.id, producto]));

  if (productos.length !== new Set(productoIds).size) {
    return Response.json({ error: "Producto no encontrado" }, { status: 400 });
  }

  const total = parsed.data.items.reduce((sum, item) => {
    const producto = productosPorId.get(item.productoId);
    return sum + (producto?.precio ?? 0) * item.cantidad;
  }, 0);

  if (total <= 0) {
    return Response.json({ error: "Importe no válido" }, { status: 400 });
  }

  if (socio.credito < total) {
    return Response.json(
      { error: "Crédito insuficiente", creditoActual: socio.credito },
      { status: 400 }
    );
  }

  const descripcion = parsed.data.items
    .map((item) => {
      const producto = productosPorId.get(item.productoId);
      return `${producto?.nombre} x${item.cantidad}`;
    })
    .join(", ");

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
        tipo: "consumo",
        cantidad: total,
        descripcion,
      },
    });

    return tx.socio.findUnique({ where: { id: socioId } });
  });

  if (!updated) {
    return Response.json(
      { error: "No se pudo completar el cobro. Revisa el crédito o el estado de la pulsera." },
      { status: 409 }
    );
  }

  return Response.json(updated);
}
