import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";

interface Row {
  dni: string;
  nombre: string;
  apellidos: string;
  tipoVinculacion: string;
  fechaNacimiento: string | null;
}

function splitApellidos(apellidos: string): [string, string?] {
  const parts = apellidos.trim().split(/\s+/);
  if (parts.length === 0) return ["", undefined];
  if (parts.length === 1) return [parts[0], undefined];
  return [parts[0], parts.slice(1).join(" ")];
}

async function generarNumeroSocio(): Promise<string> {
  const last = await db.socio.findFirst({
    orderBy: { id: "desc" },
    select: { numeroSocio: true },
  });
  let next = 1;
  if (last) {
    const m = last.numeroSocio.match(/s-(\d+)/i);
    if (m) next = parseInt(m[1]) + 1;
  }
  return `s-${String(next).padStart(3, "0")}`;
}

const CREDITO_POR_TIPO: Record<string, number> = {
  socio: 100,
  hijos_mayores: 100,
  socios_menores: 50,
  hijo_socio: 0,
};

export async function POST(request: Request) {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const rows: Row[] = await request.json();
    let creados = 0;
    let actualizados = 0;
    let omitidos = 0;
    const errores: string[] = [];

    for (const row of rows) {
      try {
        if (!row.nombre) { omitidos++; continue; }

        const [apellido1, apellido2] = splitApellidos(row.apellidos || "");
        const fechaNac = row.fechaNacimiento ? new Date(row.fechaNacimiento) : null;
        const dni = row.dni?.trim() || null;
        const credito = CREDITO_POR_TIPO[row.tipoVinculacion] ?? 0;

        if (dni) {
          const existente = await db.socio.findUnique({ where: { dni } });
          if (existente) {
            await db.socio.update({
              where: { id: existente.id },
              data: { nombre: row.nombre, apellido1, apellido2, tipoVinculacion: row.tipoVinculacion, fechaNacimiento: fechaNac },
            });
            actualizados++;
            continue;
          }
        }

        const numeroSocio = await generarNumeroSocio();
        await db.socio.create({
          data: { numeroSocio, dni, nombre: row.nombre, apellido1, apellido2, tipoVinculacion: row.tipoVinculacion, fechaNacimiento: fechaNac, credito },
        });
        creados++;
      } catch (err) {
        errores.push(`${row.nombre}: ${err instanceof Error ? err.message : "Error"}`);
      }
    }

    return Response.json({ creados, actualizados, omitidos, errores: errores.slice(0, 20) });
  } catch {
    return Response.json({ error: "Error al procesar importación" }, { status: 500 });
  }
}
