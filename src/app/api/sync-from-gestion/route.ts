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

interface SocioQR {
  id: number;
  numeroSocio: string;
  dni: string | null;
  nombre: string;
  apellido1: string | null;
  apellido2: string | null;
  credito: number;
  estadoPulsera: string;
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

function normalizar(s: string): string {
  return s.trim().toUpperCase().replace(/\s+/g, " ");
}

function normalizarDNI(dni: string | null): string | null {
  if (!dni) return null;
  return dni.trim().toUpperCase().replace(/[\s-]/g, "");
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
    const gestionSocios: GestionSocio[] = await fetchGestion(
      `socios?select=id,numero_socio,dni,nombre,apellidos,tipo_vinculacion,fecha_nacimiento`
    );

    const ejercicios: { id: string }[] = await fetchGestion(
      `ejercicios?select=id&order=created_at.desc&limit=1`
    );
    const ejercicioId = ejercicios[0]?.id;

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

    // Normalizar DNIs evitando duplicados: para cada DNI repetido, dejar solo el primero
    await db.$executeRawUnsafe(`
      WITH normalizados AS (
        SELECT id, UPPER(REPLACE(REPLACE(TRIM(dni), ' ', ''), '-', '')) AS dni_norm
        FROM "Socio" WHERE dni IS NOT NULL
      ),
      con_fila AS (
        SELECT id, dni_norm, ROW_NUMBER() OVER (PARTITION BY dni_norm ORDER BY id) AS rn
        FROM normalizados
      )
      UPDATE "Socio" s SET dni = NULL
      FROM con_fila cf
      WHERE s.id = cf.id AND cf.rn > 1
    `);
    await db.$executeRawUnsafe(`
      UPDATE "Socio" SET dni = UPPER(REPLACE(REPLACE(TRIM(dni), ' ', ''), '-', ''))
      WHERE dni IS NOT NULL
    `);

    // Cargar todos los socios de QR una sola vez
    const todosQR = await db.socio.findMany({
      select: {
        id: true,
        numeroSocio: true,
        dni: true,
        nombre: true,
        apellido1: true,
        apellido2: true,
        credito: true,
        estadoPulsera: true,
      },
    });

    // Indexar por numeroSocio y por DNI para búsqueda rápida
    const porNumero = new Map<string, SocioQR>();
    const porDni = new Map<string, SocioQR>();
    for (const sq of todosQR) {
      porNumero.set(sq.numeroSocio, sq);
      if (sq.dni) porDni.set(normalizarDNI(sq.dni)!, sq);
    }

    let actualizados = 0;
    let creados = 0;
    let desactivados = 0;
    let noEncontrados = 0;
    const errores: string[] = [];

    for (const gs of gestionSocios) {
      try {
        const numSocioInt = gs.numero_socio ?? 0;
        const numeroSocio = `s-${String(numSocioInt).padStart(3, "0")}`;
        const tipoVinculacion = gs.tipo_vinculacion;
        const activo = activosSet.has(gs.id);
        const fechaNac = gs.fecha_nacimiento ? new Date(gs.fecha_nacimiento) : null;

        // Buscar existente
        let existente = porNumero.get(numeroSocio);

        const dniNorm = normalizarDNI(gs.dni);

        if (!existente && dniNorm) {
          existente = porDni.get(dniNorm);
        }

        if (!existente) {
          // Búsqueda por nombre completo (socios con nombre+apellidos separados
          // o nombre completo antiguo en el campo nombre)
          const nombreCompletoGestion = normalizar(`${gs.nombre} ${gs.apellidos}`);
          existente = todosQR.find((sq) => {
            const nombreCompletoQR = normalizar(
              [sq.nombre, sq.apellido1, sq.apellido2].filter(Boolean).join(" ")
            );
            return nombreCompletoGestion === nombreCompletoQR;
          });
        }

        if (existente) {
          // Si el DNI tiene que cambiar y ya está en otro socio, quitarlo de allí
          if (dniNorm && normalizarDNI(existente.dni) !== dniNorm) {
            await db.$executeRawUnsafe(
              `UPDATE "Socio" SET dni = NULL WHERE REPLACE(REPLACE(dni, ' ', ''), '-', '') = $1 AND id != $2`,
              dniNorm, existente.id
            );
            for (const [key, val] of porDni) {
              if (key === dniNorm && val.id !== existente.id) porDni.delete(key);
            }
          }

          const apellidosSplit = gs.apellidos.trim().split(/\s+/);
          const ape1 = apellidosSplit[0] || "";
          const ape2 = apellidosSplit.length > 1 ? apellidosSplit.slice(1).join(" ") : null;

          await db.socio.update({
            where: { id: existente.id },
            data: {
              numeroSocio,
              nombre: gs.nombre,
              apellido1: ape1,
              apellido2: ape2,
              dni: dniNorm,
              tipoVinculacion,
              fechaNacimiento: fechaNac,
              estadoPulsera: activo ? "activa" : "inactiva",
            },
          });

          // Refrescar índices locales
          if (dniNorm) porDni.set(dniNorm, { ...existente, numeroSocio, dni: dniNorm });
          else if (existente.dni) porDni.delete(normalizarDNI(existente.dni)!);

          actualizados++;
        } else {
          // Buscar por DNI normalizado en BD por si existe con otro nº de socio
          if (!existente && dniNorm) {
            const dupe = await db.$queryRawUnsafe<{ id: number }[]>(
              `SELECT id FROM "Socio" WHERE REPLACE(REPLACE(dni, ' ', ''), '-', '') = $1 LIMIT 1`,
              dniNorm
            );
            if (dupe.length > 0) {
              existente = await db.socio.findUnique({ where: { id: dupe[0].id } });
            }
          }
        }

        if (existente) {
          const apellidosSplit = gs.apellidos.trim().split(/\s+/);
          const ape1 = apellidosSplit[0] || "";
          const ape2 = apellidosSplit.length > 1 ? apellidosSplit.slice(1).join(" ") : null;

          await db.socio.update({
            where: { id: existente.id },
            data: {
              numeroSocio,
              nombre: gs.nombre,
              apellido1: ape1,
              apellido2: ape2,
              dni: dniNorm,
              tipoVinculacion,
              fechaNacimiento: fechaNac,
              estadoPulsera: activo ? "activa" : "inactiva",
            },
          });

          if (dniNorm) porDni.set(dniNorm, { ...existente, numeroSocio, dni: dniNorm });
          else if (existente.dni) porDni.delete(normalizarDNI(existente.dni)!);

          actualizados++;
        } else {
          const credito = CREDITO_POR_TIPO[tipoVinculacion] ?? 0;
          const apellidosSplit = gs.apellidos.trim().split(/\s+/);
          const ape1 = apellidosSplit[0] || "";
          const ape2 = apellidosSplit.length > 1 ? apellidosSplit.slice(1).join(" ") : null;

          const nuevo = await db.socio.create({
            data: {
              numeroSocio,
              nombre: gs.nombre,
              apellido1: ape1,
              apellido2: ape2,
              dni: dniNorm,
              tipoVinculacion,
              fechaNacimiento: fechaNac,
              credito,
              estadoPulsera: activo ? "activa" : "inactiva",
            },
          });

          if (dniNorm) porDni.set(dniNorm, nuevo);
          todosQR.push(nuevo);
          creados++;
        }
      } catch (err) {
        errores.push(`${gs.nombre}: ${err instanceof Error ? err.message : "Error"}`);
      }
    }

    // Desactivar socios que ya no están en gestión (sin crédito pendiente)
    const gestionNums = new Set(
      gestionSocios.map((s) => s.numero_socio).filter((n): n is number => n !== null)
    );

    const activosQR = await db.socio.findMany({
      where: { estadoPulsera: "activa" },
      select: { id: true, numeroSocio: true, credito: true },
    });

    for (const sq of activosQR) {
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
      noEncontrados,
      errores: errores.slice(0, 20),
    });
  } catch (err) {
    return apiError(
      err instanceof Error ? err.message : "Error en sincronización",
      500
    );
  }
}
