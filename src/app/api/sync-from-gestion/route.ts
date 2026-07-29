import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { apiError, apiSuccess } from "@/lib/api-error";
import { syncGestionMembers } from "@/lib/batch-sync";

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
  filada_id: number | null;
}

interface GestionFilada {
  id: number;
  nombre: string;
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

export async function POST() {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return apiError("No autorizado", 401);
  }

  try {
    const gestionSocios: GestionSocio[] = await fetchGestion(
      `socios?select=id,numero_socio,dni,nombre,apellidos,tipo_vinculacion,fecha_nacimiento,filada_id`
    );

    const filadas: GestionFilada[] = await fetchGestion(
      `filadas?select=id,nombre`
    );
    const filadaMap = new Map<number, string>();
    for (const f of filadas) {
      filadaMap.set(f.id, f.nombre);
    }

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

    const result = await syncGestionMembers({
      gestionSocios,
      filadas,
      activeMemberIds: activosSet,
      client: db as never,
    });

    return apiSuccess(result);
  } catch (err) {
    return apiError(
      err instanceof Error ? err.message : "Error en sincronización",
      500
    );
  }
}
