import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { apiError, apiSuccess } from "@/lib/api-error";

interface Row {
  numeroSocio: string | null;
  dni: string;
  nombre: string;
  apellidos: string;
  tipoVinculacion: string;
  fechaNacimiento: string | null;
  activo: string | null;
}

function splitApellidos(apellidos: string): [string, string?] {
  const parts = apellidos.trim().split(/\s+/);
  if (parts.length === 0) return ["", undefined];
  if (parts.length === 1) return [parts[0], undefined];
  return [parts[0], parts.slice(1).join(" ")];
}

async function generarNumeroSocio(): Promise<string> {
  const [result] = await db.$queryRawUnsafe<{ nextval: number }[]>(
    `SELECT nextval('"Socio_numero_sequence"') AS nextval`
  );
  return `s-${String(result.nextval).padStart(3, "0")}`;
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return apiError("No autorizado", 401);
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
        const activo = row.activo?.trim().toLowerCase() === "true";
        const credito = 0;

        // Formatear numeroSocio si viene del CSV
        let numeroSocio: string | null = null;
        if (row.numeroSocio) {
          const num = parseInt(row.numeroSocio);
          if (!isNaN(num)) {
            numeroSocio = `s-${String(num).padStart(3, "0")}`;
          }
        }

        // Buscar existente: primero por numeroSocio, luego por DNI
        let existente = null;
        if (numeroSocio) {
          existente = await db.socio.findUnique({ where: { numeroSocio } });
        }
        if (!existente && dni) {
          existente = await db.socio.findUnique({ where: { dni } });
        }

        if (existente) {
          await db.socio.update({
            where: { id: existente.id },
            data: {
              nombre: row.nombre,
              apellido1,
              apellido2,
              dni,
              tipoVinculacion: row.tipoVinculacion as any,
              fechaNacimiento: fechaNac,
              estadoPulsera: activo ? existente.estadoPulsera : "inactiva",
            },
          });
          actualizados++;
          continue;
        }

        // No existe: crear con numeroSocio del CSV o auto-generado
        const finalNumeroSocio = numeroSocio || await generarNumeroSocio();
        await db.socio.create({
          data: {
            numeroSocio: finalNumeroSocio,
            dni,
            nombre: row.nombre,
            apellido1,
            apellido2,
            tipoVinculacion: row.tipoVinculacion as any,
            fechaNacimiento: fechaNac,
            credito,
            estadoPulsera: activo ? "activa" : "inactiva",
          },
        });
        creados++;
      } catch (err) {
        errores.push(`${row.nombre}: ${err instanceof Error ? err.message : "Error"}`);
      }
    }

    return apiSuccess({ creados, actualizados, omitidos, errores: errores.slice(0, 20) });
  } catch {
    return apiError("Error al procesar importación", 500);
  }
}
