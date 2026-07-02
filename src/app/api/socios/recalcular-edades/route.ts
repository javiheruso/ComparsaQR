import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { apiError, apiSuccess } from "@/lib/api-error";

export async function POST() {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return apiError("No autorizado", 401);
  }

  const hoy = new Date();
  const hace18Anios = new Date(hoy.getFullYear() - 18, hoy.getMonth(), hoy.getDate());

  const reclasificados: { id: number; nombre: string; de: string; a: string }[] = [];

  const menoresAMayores = await db.socio.findMany({
    where: {
      tipoVinculacion: "socios_menores",
      fechaNacimiento: { lte: hace18Anios, not: null },
    },
  });
  for (const s of menoresAMayores) {
    await db.socio.update({
      where: { id: s.id },
      data: { tipoVinculacion: "socio" as const },
    });
    reclasificados.push({ id: s.id, nombre: s.nombre, de: "socios_menores", a: "socio" });
  }

  const hijosMenoresAMayores = await db.socio.findMany({
    where: {
      tipoVinculacion: "hijo_socio",
      fechaNacimiento: { lte: hace18Anios, not: null },
    },
  });
  for (const s of hijosMenoresAMayores) {
    await db.socio.update({
      where: { id: s.id },
      data: { tipoVinculacion: "hijos_mayores" as const },
    });
    reclasificados.push({ id: s.id, nombre: s.nombre, de: "hijo_socio", a: "hijos_mayores" });
  }

  return apiSuccess({ total: reclasificados.length, reclasificados });
}
