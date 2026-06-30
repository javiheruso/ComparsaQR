import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function POST() {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }

  const hoy = new Date();
  const hace18Anios = new Date(hoy.getFullYear() - 18, hoy.getMonth(), hoy.getDate());

  const reclasificados: { id: number; nombre: string; de: string; a: string }[] = [];

  // socios_menores con 18+ → socio (100€)
  const menoresAMayores = await db.socio.findMany({
    where: {
      tipoVinculacion: "socios_menores",
      fechaNacimiento: { lte: hace18Anios, not: null },
    },
  });
  for (const s of menoresAMayores) {
    await db.socio.update({
      where: { id: s.id },
      data: { tipoVinculacion: "socio" },
    });
    reclasificados.push({ id: s.id, nombre: s.nombre, de: "socios_menores", a: "socio" });
  }

  // hijo_socio con 18+ → hijos_mayores (100€)
  const hijosMenoresAMayores = await db.socio.findMany({
    where: {
      tipoVinculacion: "hijo_socio",
      fechaNacimiento: { lte: hace18Anios, not: null },
    },
  });
  for (const s of hijosMenoresAMayores) {
    await db.socio.update({
      where: { id: s.id },
      data: { tipoVinculacion: "hijos_mayores" },
    });
    reclasificados.push({ id: s.id, nombre: s.nombre, de: "hijo_socio", a: "hijos_mayores" });
  }

  return Response.json({ total: reclasificados.length, reclasificados });
}
