import { beforeEach, describe, expect, it } from "vitest";

import {
  importGestionRows,
  processMassCredit,
  syncGestionMembers,
} from "@/lib/batch-sync";

type SocioRecord = {
  id: number;
  numeroSocio: string;
  dni: string | null;
  nombre: string;
  apellido1: string | null;
  apellido2: string | null;
  tipoVinculacion: "socio" | "hijo_socio" | "hijos_mayores" | "socios_menores";
  fechaNacimiento: Date | null;
  filada: string | null;
  credito: number;
  creditoNoRetornable: number;
  estadoPulsera: "activa" | "inactiva";
};

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

type HarnessDb = {
  socio: {
    findMany: (args?: { where?: Record<string, unknown>; select?: Record<string, boolean> }) => Promise<SocioRecord[]>;
    findUnique: (args: { where: Record<string, unknown>; select?: Record<string, boolean> }) => Promise<SocioRecord | null>;
    create: (args: { data: Omit<SocioRecord, "id"> }) => Promise<SocioRecord>;
    update: (args: { where: { id: number }; data: Record<string, unknown> }) => Promise<SocioRecord>;
    updateMany: (args: { where?: Record<string, unknown>; data: Record<string, unknown> }) => Promise<{ count: number }>;
  };
  transaccion: {
    create: (args: { data: Record<string, unknown> }) => Promise<{ id: number }>;
    createMany: (args: { data: Array<Record<string, unknown>> }) => Promise<{ count: number }>;
  };
  idempotencyRecord: {
    findUnique: (args: { where: { scope_key: { scope: string; key: string } } }) => Promise<{
      scope: string;
      key: string;
      requestHash: string;
      status: string;
      responseCode: number | null;
      responseBody: JsonValue;
      createdAt: Date;
      updatedAt: Date;
    } | null>;
    create: (args: { data: { scope: string; key: string; requestHash: string; status: string } }) => Promise<{
      scope: string;
      key: string;
      requestHash: string;
      status: string;
      responseCode: number | null;
      responseBody: JsonValue;
      createdAt: Date;
      updatedAt: Date;
    }>;
    update: (args: { where: { scope_key: { scope: string; key: string } }; data: { status: string; responseCode: number; responseBody: JsonValue } }) => Promise<{
      scope: string;
      key: string;
      requestHash: string;
      status: string;
      responseCode: number | null;
      responseBody: JsonValue;
      createdAt: Date;
      updatedAt: Date;
    }>;
  };
  $transaction: <T>(callback: (tx: HarnessDb) => Promise<T>) => Promise<T>;
};

function createHarness() {
  const state: {
    socios: SocioRecord[];
    transacciones: Array<Record<string, unknown>>;
    idempotencyRecords: Map<string, {
      scope: string;
      key: string;
      requestHash: string;
      status: string;
      responseCode: number | null;
      responseBody: JsonValue;
      createdAt: Date;
      updatedAt: Date;
    }>;
    nextSocioId: number;
    nextTransaccionId: number;
    failCreateOnceFor: Set<string>;
  } = {
    socios: [
      {
        id: 1,
        numeroSocio: "s-001",
        dni: "111A",
        nombre: "ADA",
        apellido1: "LOVELACE",
        apellido2: null,
        tipoVinculacion: "socio" as const,
        fechaNacimiento: null,
        filada: null,
        credito: 10,
        creditoNoRetornable: 2,
        estadoPulsera: "activa" as const,
      },
      {
        id: 2,
        numeroSocio: "s-002",
        dni: "222B",
        nombre: "GRACE",
        apellido1: "HOPPER",
        apellido2: null,
        tipoVinculacion: "socio" as const,
        fechaNacimiento: null,
        filada: null,
        credito: 8,
        creditoNoRetornable: 1,
        estadoPulsera: "activa" as const,
      },
    ],
    transacciones: [] as Array<Record<string, unknown>>,
    idempotencyRecords: new Map<string, {
      scope: string;
      key: string;
      requestHash: string;
      status: string;
      responseCode: number | null;
      responseBody: JsonValue;
      createdAt: Date;
      updatedAt: Date;
    }>(),
    nextSocioId: 3,
    nextTransaccionId: 1,
    failCreateOnceFor: new Set<string>(),
  };

  const toNumber = (value: unknown) => Math.round(Number(String(value)) * 100) / 100;
  const pick = <T extends Record<string, unknown>>(record: T, select?: Record<string, boolean>) => {
    if (!select) {
      return { ...record };
    }

    return Object.fromEntries(Object.keys(select).filter((key) => select[key]).map((key) => [key, record[key]]));
  };
  const matchesWhere = (socio: SocioRecord, where: Record<string, unknown> = {}) => {
    if (where.id && typeof where.id === "object" && where.id !== null && "in" in where.id) {
      if (!(where.id.in as number[]).includes(socio.id)) return false;
    } else if (typeof where.id === "number" && socio.id !== where.id) {
      return false;
    }

    if (where.numeroSocio && socio.numeroSocio !== where.numeroSocio) return false;
    if (where.dni && socio.dni !== where.dni) return false;
    if (where.tipoVinculacion && socio.tipoVinculacion !== where.tipoVinculacion) return false;
    if (where.estadoPulsera && socio.estadoPulsera !== where.estadoPulsera) return false;
    if (where.credito && typeof where.credito === "object" && where.credito !== null && "lte" in where.credito) {
      if (socio.credito > toNumber(where.credito.lte)) return false;
    }

    return true;
  };

  let db: HarnessDb;
  db = {
    socio: {
      findMany: async ({ where, select }: { where?: Record<string, unknown>; select?: Record<string, boolean> } = {}) =>
        state.socios.filter((socio) => matchesWhere(socio, where)).map((socio) => pick(socio, select) as SocioRecord),
      findUnique: async ({ where, select }: { where: Record<string, unknown>; select?: Record<string, boolean> }) => {
        const socio = state.socios.find((candidate) => matchesWhere(candidate, where));
        return socio ? (pick(socio, select) as SocioRecord) : null;
      },
      create: async ({ data }: { data: Omit<SocioRecord, "id"> }) => {
        if (state.failCreateOnceFor.has(data.nombre)) {
          state.failCreateOnceFor.delete(data.nombre);
          throw new Error(`forced create failure for ${data.nombre}`);
        }

        const socio: SocioRecord = { id: state.nextSocioId++, ...data };
        state.socios.push(socio);
        return { ...socio };
      },
      update: async ({ where, data }: { where: { id: number }; data: Record<string, unknown> }) => {
        const socio = state.socios.find((candidate) => candidate.id === where.id);
        if (!socio) throw new Error("Socio not found");

        if (data.credito && typeof data.credito === "object" && data.credito !== null) {
          if ("increment" in data.credito) socio.credito = Math.round((socio.credito + toNumber(data.credito.increment)) * 100) / 100;
          if ("decrement" in data.credito) socio.credito = Math.round((socio.credito - toNumber(data.credito.decrement)) * 100) / 100;
        }

        if (data.creditoNoRetornable && typeof data.creditoNoRetornable === "object" && data.creditoNoRetornable !== null) {
          if ("increment" in data.creditoNoRetornable) socio.creditoNoRetornable = Math.round((socio.creditoNoRetornable + toNumber(data.creditoNoRetornable.increment)) * 100) / 100;
          if ("decrement" in data.creditoNoRetornable) socio.creditoNoRetornable = Math.round((socio.creditoNoRetornable - toNumber(data.creditoNoRetornable.decrement)) * 100) / 100;
        }

        if (data.numeroSocio !== undefined) socio.numeroSocio = String(data.numeroSocio);
        if (data.dni !== undefined) socio.dni = data.dni as string | null;
        if (data.nombre !== undefined) socio.nombre = String(data.nombre);
        if (data.apellido1 !== undefined) socio.apellido1 = data.apellido1 as string | null;
        if (data.apellido2 !== undefined) socio.apellido2 = data.apellido2 as string | null;
        if (data.tipoVinculacion !== undefined) socio.tipoVinculacion = data.tipoVinculacion as SocioRecord["tipoVinculacion"];
        if (data.fechaNacimiento !== undefined) socio.fechaNacimiento = data.fechaNacimiento as Date | null;
        if (data.estadoPulsera !== undefined) socio.estadoPulsera = data.estadoPulsera as SocioRecord["estadoPulsera"];
        if (data.filada !== undefined) socio.filada = data.filada as string | null;

        return { ...socio };
      },
      updateMany: async ({ where, data }: { where?: Record<string, unknown>; data: Record<string, unknown> }) => {
        let count = 0;
        for (const socio of state.socios) {
          if (!matchesWhere(socio, where)) continue;
          count += 1;
          if (data.dni !== undefined) socio.dni = data.dni as string | null;
          if (data.estadoPulsera !== undefined) socio.estadoPulsera = data.estadoPulsera as SocioRecord["estadoPulsera"];
        }
        return { count };
      },
    },
    transaccion: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const transaccion = { id: state.nextTransaccionId++, ...data };
        state.transacciones.push(transaccion);
        return transaccion;
      },
      createMany: async ({ data }: { data: Array<Record<string, unknown>> }) => {
        for (const item of data) {
          state.transacciones.push({ id: state.nextTransaccionId++, ...item });
        }
        return { count: data.length };
      },
    },
    idempotencyRecord: {
      findUnique: async ({ where }: { where: { scope_key: { scope: string; key: string } } }) => {
        const record = state.idempotencyRecords.get(`${where.scope_key.scope}::${where.scope_key.key}`);
        return record ? { ...record } : null;
      },
      create: async ({ data }: { data: { scope: string; key: string; requestHash: string; status: string } }) => {
        const id = `${data.scope}::${data.key}`;
        if (state.idempotencyRecords.has(id)) {
          throw { code: "P2002" };
        }

        const record = {
          ...data,
          responseCode: null,
          responseBody: null,
          createdAt: new Date("2026-07-29T00:00:00.000Z"),
          updatedAt: new Date("2026-07-29T00:00:00.000Z"),
        };
        state.idempotencyRecords.set(id, record);
        return { ...record };
      },
      update: async ({ where, data }: { where: { scope_key: { scope: string; key: string } }; data: { status: string; responseCode: number; responseBody: JsonValue } }) => {
        const id = `${where.scope_key.scope}::${where.scope_key.key}`;
        const record = state.idempotencyRecords.get(id);
        if (!record) throw new Error("Missing idempotency record");

        const updated = { ...record, ...data, updatedAt: new Date("2026-07-29T00:01:00.000Z") };
        state.idempotencyRecords.set(id, updated);
        return { ...updated };
      },
    },
    $transaction: async <T>(callback: (tx: typeof db) => Promise<T>) => {
      const snapshot = {
        socios: state.socios.map((socio) => ({ ...socio })),
        transacciones: state.transacciones.map((transaccion) => ({ ...transaccion })),
        idempotencyRecords: new Map(
          [...state.idempotencyRecords.entries()].map(([key, value]) => [key, { ...value }]),
        ),
        nextSocioId: state.nextSocioId,
        nextTransaccionId: state.nextTransaccionId,
      };

      try {
        return await callback(db);
      } catch (error) {
        state.socios.splice(0, state.socios.length, ...snapshot.socios);
        state.transacciones.splice(0, state.transacciones.length, ...snapshot.transacciones);
        state.idempotencyRecords.clear();
        for (const [key, value] of snapshot.idempotencyRecords.entries()) {
          state.idempotencyRecords.set(key, value);
        }
        state.nextSocioId = snapshot.nextSocioId;
        state.nextTransaccionId = snapshot.nextTransaccionId;
        throw error;
      }
    },
  };

  return { db, state };
}

describe("batch sync hardening", () => {
  let harness: ReturnType<typeof createHarness>;

  beforeEach(() => {
    harness = createHarness();
  });

  it("skips already applied member credits when the same batch is retried", async () => {
    const firstRun = await processMassCredit({
      batchKey: "mass-credit-july",
      tipoVinculacion: "socio",
      cantidad: 5,
      descripcion: "Summer load",
      noRetornable: false,
      session: { actorType: "admin", actorId: "admin", isLoggedIn: true, sessionVersion: 1 },
      client: harness.db,
    });

    const retryRun = await processMassCredit({
      batchKey: "mass-credit-july",
      tipoVinculacion: "socio",
      cantidad: 5,
      descripcion: "Summer load",
      noRetornable: false,
      session: { actorType: "admin", actorId: "admin", isLoggedIn: true, sessionVersion: 1 },
      client: harness.db,
    });

    expect(firstRun).toMatchObject({ procesados: 2, aplicados: 2, omitidos: 0, reintentados: 0 });
    expect(retryRun).toMatchObject({ procesados: 2, aplicados: 0, omitidos: 2, reintentados: 2 });
    expect(harness.state.socios.map((socio) => socio.credito)).toEqual([15, 13]);
    expect(harness.state.transacciones).toHaveLength(2);
  });

  it("resumes imports after a partial failure without duplicating the completed rows", async () => {
    harness.state.failCreateOnceFor.add("KATHERINE");

    const rows = [
      {
        numeroSocio: "3",
        dni: "333C",
        nombre: "HEDY",
        apellidos: "LAMARR",
        tipoVinculacion: "socio",
        fechaNacimiento: null,
        activo: "true",
      },
      {
        numeroSocio: null,
        dni: "444D",
        nombre: "KATHERINE",
        apellidos: "JOHNSON",
        tipoVinculacion: "socio",
        fechaNacimiento: null,
        activo: "true",
      },
    ];

    const firstRun = await importGestionRows({ batchKey: "import-gestion-1", rows, client: harness.db });
    const retryRun = await importGestionRows({ batchKey: "import-gestion-1", rows, client: harness.db });

    expect(firstRun).toMatchObject({ creados: 1, actualizados: 0, omitidos: 0, reintentados: 0 });
    expect(firstRun.errores).toEqual(["KATHERINE: forced create failure for KATHERINE"]);
    expect(retryRun).toMatchObject({ creados: 1, actualizados: 0, omitidos: 0, reintentados: 1 });
    expect(retryRun.errores).toEqual([]);
    expect(harness.state.socios.filter((socio) => socio.dni === "333C")).toHaveLength(1);
    expect(harness.state.socios.filter((socio) => socio.dni === "444D")).toHaveLength(1);
  });

  it("treats identical gestion snapshots as no-op retries instead of duplicating members", async () => {
    const snapshot = {
      gestionSocios: [
        {
          id: "gestion-1",
          numero_socio: 7,
          dni: "777Z",
          nombre: "MARGARET",
          apellidos: "HAMILTON",
          tipo_vinculacion: "socio" as const,
          fecha_nacimiento: null,
          filada_id: 10,
        },
      ],
      filadas: [{ id: 10, nombre: "Primera" }],
      activeMemberIds: new Set<string>(["gestion-1"]),
    };

    const firstRun = await syncGestionMembers({ ...snapshot, client: harness.db });
    const retryRun = await syncGestionMembers({ ...snapshot, client: harness.db });

    expect(firstRun).toMatchObject({ creados: 1, actualizados: 0, desactivados: 0, sinCambios: 0 });
    expect(retryRun).toMatchObject({ creados: 0, actualizados: 0, desactivados: 0, sinCambios: 1 });
    expect(harness.state.socios.filter((socio) => socio.dni === "777Z")).toHaveLength(1);
  });
});
