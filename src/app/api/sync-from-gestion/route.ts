import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { apiError, apiSuccess } from "@/lib/api-error";

const GESTION_URL = process.env.GESTION_SUPABASE_URL!;
const GESTION_KEY = process.env.GESTION_SUPABASE_KEY!;

interface GestionSocio {
  id: string;
  numero_socio: number | null;
  dni: string | null;
  nombre: string;
  apellidos: string;
  tipo_vinculacion: "socio" | "hijo_socio" | "hijos_mayores" | "socios_menores";
  fecha_nacimiento: string | null;
}

interface Membresia {
  socio_id: string;
  estado: "activo" | "baja" | "suspendido";
}

async function fetchGestion<T>(endpoint: string): Promise<T[]> {
  const res = await fetch(`${GESTION_URL}/rest/v1/${endpoint}`, {
    headers: {
      apikey: GESTION_KEY,
      Authorization: `Bearer ${GESTION_KEY}`,
    },
  });
  if (!res.ok) throw new Error(`Error fetching ${endpoint}: ${res.status}`);
  return res.json();
}

function splitApellidos(apellidos: string): [string, string?] {
  const parts = apellidos.trim().split(/\s+/);
  if (parts.length === 0) return ["", undefined];
  if (parts.length === 1) return [parts[0], undefined];
  return [parts[0], parts.slice(1).join(" ")];
}

const CREDITO_POR_TIPO: Record<string, number> = {
  socio: 100,
  hijos_mayores: 100,
  socios_menores: 50,
  hijo_socio: 0,
};

export async function POST() {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return apiError("No autorizado", 401);
  }

  try {
    // 1) Leer socios de llaganyosos
    const gestionSocios: GestionSocio[] = await fetchGestion(
      `socios?select=id,numero_socio,dni,nombre,apellidos,tipo_vinculacion,fecha_nacimiento`
    );

    // 2) Obtener el último ejercicio
    const ejercicios: { id: string }[] = await fetchGestion(
      `ejercicios?select=id&order=created_at.desc&limit=1`
    );
    const ejercicioId = ejercicios[0]?.id;

    // 3) Leer membresías del ejercicio activo
    const activosSet = new Set<string>();

    if (ejercicioId) {
      const membresias: Membresia[] = await fetchGestion(
        `membresias?select=socio_id,estado&ejercicio_id=eq.${ejercicioId}`
      );
      for (const m of membresias) {
        if (m.estado === "activo") activosSet.add(m.socio_id);
      }
    } else {
      for (const s of gestionSocios) activosSet.add(s.id);
    }

    let creados = 0;
    let actualizados = 0;
    let desactivados = 0;
    const errores: string[] = [];

    // 4) Sincronizar cada socio
    for (const gs of gestionSocios) {
      try {
        const numSocioInt = gs.numero_socio ?? 0;
        const numeroSocio = `s-${String(numSocioInt).padStart(3, "0")}`;
        const tipoVinculacion = gs.tipo_vinculacion;
        const activo = activosSet.has(gs.id);
        const fechaNac = gs.fecha_nacimiento ? new Date(gs.fecha_nacimiento) : null;
        const [apellido1, apellido2] = splitApellidos(gs.apellidos);

        const existente = await db.socio.findUnique({ where: { numeroSocio } });

        if (existente) {
          await db.socio.update({
            where: { id: existente.id },
            data: {
              nombre: gs.nombre,
              apellido1,
              apellido2,
              dni: gs.dni,
              tipoVinculacion,
              fechaNacimiento: fechaNac,
              estadoPulsera: activo ? "activa" : "inactiva",
            },
          });
          actualizados++;
        } else {
          const credito = CREDITO_POR_TIPO[tipoVinculacion] ?? 0;

          await db.socio.create({
            data: {
              numeroSocio,
              nombre: gs.nombre,
              apellido1,
              apellido2,
              dni: gs.dni,
              tipoVinculacion,
              fechaNacimiento: fechaNac,
              credito,
              estadoPulsera: activo ? "activa" : "inactiva",
            },
          });
          creados++;
        }
      } catch (err) {
        errores.push(`${gs.nombre}: ${err instanceof Error ? err.message : "Error"}`);
      }
    }

    // 5) Desactivar socios que ya no están en gestión (sin crédito pendiente)
    const gestionNums = new Set(
      gestionSocios.map((s) => s.numero_socio).filter((n): n is number => n !== null)
    );

    const sociosQR = await db.socio.findMany({
      where: { estadoPulsera: "activa" },
      select: { id: true, numeroSocio: true, credito: true },
    });

    for (const sq of sociosQR) {
      const match = sq.numeroSocio.match(/s-(\d+)/i);
      const num = match ? parseInt(match[1]) : -1;
      if (!gestionNums.has(num) && sq.credito <= 0) {
        await db.socio.update({
          where: { id: sq.id },
          data: { estadoPulsera: "inactiva" },
        });
        desactivados++;
      }
    }

    return apiSuccess({
      creados,
      actualizados,
      desactivados,
      errores: errores.slice(0, 20),
    });
  } catch (err) {
    return apiError(
      err instanceof Error ? err.message : "Error en sincronización",
      500
    );
  }
}
