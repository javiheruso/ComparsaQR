import { Decimal } from "@prisma/client/runtime/client";

import type { SessionData } from "@/lib/auth";
import { getActorContext } from "@/lib/access";
import {
  createIdempotencyScope,
  createPrismaIdempotencyStore,
  executeIdempotent,
  hashIdempotencyPayload,
} from "@/lib/idempotency";
import { moneyToNumber, parseMoney, serializeMoney } from "@/lib/money";

type TipoVinculacion = "socio" | "hijo_socio" | "hijos_mayores" | "socios_menores";
type EstadoPulsera = "activa" | "inactiva" | "perdida";
type BatchMutationAction = "created" | "updated" | "unchanged";
type MatchStrength = "numeroSocio" | "dni" | "name" | "none";

type SocioRecord = {
  id: number;
  numeroSocio: string;
  dni: string | null;
  nombre: string;
  apellido1: string | null;
  apellido2: string | null;
  tipoVinculacion: TipoVinculacion;
  fechaNacimiento: Date | null;
  credito: unknown;
  creditoNoRetornable: unknown;
  estadoPulsera: EstadoPulsera | string;
  filada?: string | null;
};

type BatchSyncClient = {
  socio: {
    findMany(args?: { where?: Record<string, unknown>; select?: Record<string, boolean> }): Promise<SocioRecord[]>;
    findUnique(args: { where: Record<string, unknown>; select?: Record<string, boolean> }): Promise<SocioRecord | null>;
    create(args: { data: Omit<SocioRecord, "id"> }): Promise<SocioRecord>;
    update(args: { where: { id: number }; data: Record<string, unknown> }): Promise<SocioRecord>;
    updateMany(args: { where?: Record<string, unknown>; data: Record<string, unknown> }): Promise<{ count: number }>;
  };
  transaccion: {
    create(args: { data: Record<string, unknown> }): Promise<{ id: number }>;
  };
  idempotencyRecord: Parameters<typeof createPrismaIdempotencyStore>[0]["idempotencyRecord"];
  $transaction?<T>(callback: (tx: BatchSyncClient) => Promise<T>): Promise<T>;
};

type MoneyActorSession = Partial<SessionData> | null | undefined;

export type GestionImportRow = {
  numeroSocio: string | null;
  dni: string;
  nombre: string;
  apellidos: string;
  tipoVinculacion: string;
  fechaNacimiento: string | null;
  activo: string | null;
};

export type GestionSocioSnapshot = {
  id: string;
  numero_socio: number | null;
  dni: string | null;
  nombre: string;
  apellidos: string;
  tipo_vinculacion: TipoVinculacion;
  fecha_nacimiento: string | null;
  filada_id: number | null;
};

export type GestionFiladaSnapshot = {
  id: number;
  nombre: string;
};

function getClient(client: BatchSyncClient) {
  return client;
}

async function runInTransaction<T>(client: BatchSyncClient, operation: (tx: BatchSyncClient) => Promise<T>): Promise<T> {
  if (client.$transaction) {
    return client.$transaction(operation);
  }

  return operation(client);
}

function splitApellidos(apellidos: string): [string | null, string | null] {
  const parts = apellidos.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return [null, null];
  if (parts.length === 1) return [parts[0], null];
  return [parts[0], parts.slice(1).join(" ")];
}

function normalizeDni(dni: string | null): string | null {
  if (!dni) return null;
  const normalized = dni.trim().toUpperCase().replace(/[\s-]/g, "");
  return normalized || null;
}

function normalizeName(value: string): string {
  return value.trim().toUpperCase().replace(/\s+/g, " ");
}

function formatNumeroSocio(value: string | number | null | undefined): string | null {
  if (value === null || value === undefined || value === "") return null;
  const numeric = typeof value === "number" ? value : Number.parseInt(String(value), 10);
  if (Number.isNaN(numeric)) return null;
  return `s-${String(numeric).padStart(3, "0")}`;
}

function getActorMetadata(session: MoneyActorSession) {
  const actor = getActorContext(session);

  return {
    operator:
      actor.actorType === "admin"
        ? session?.adminNombre ?? session?.adminUsername ?? "admin"
        : actor.actorType === "punto"
          ? session?.puntoNombre ?? "punto"
          : actor.actorType === "scanner"
            ? "scanner"
            : null,
    puntoVentaId: session?.puntoVentaId ?? null,
  };
}

function deriveBatchKey(prefix: string, payload: unknown, explicitKey?: string | null) {
  const normalizedKey = explicitKey?.trim();
  if (normalizedKey) {
    return normalizedKey;
  }

  return `${prefix}:${hashIdempotencyPayload(payload as never)}`;
}

function parseUnknownMoney(value: unknown) {
  if (typeof value === "string" || typeof value === "number" || value instanceof Decimal) {
    return parseMoney(value);
  }

  throw new TypeError("Expected a supported money value");
}

function readAction(body: unknown): BatchMutationAction | null {
  if (
    typeof body === "object" &&
    body !== null &&
    "action" in body &&
    (body.action === "created" || body.action === "updated" || body.action === "unchanged")
  ) {
    return body.action;
  }

  return null;
}

async function findExistingSocio(tx: BatchSyncClient, row: GestionImportRow | GestionSocioSnapshot) {
  const numeroSocio = "numero_socio" in row ? formatNumeroSocio(row.numero_socio) : formatNumeroSocio(row.numeroSocio);
  const dni = normalizeDni(row.dni);

  if (numeroSocio) {
    const foundByNumber = await tx.socio.findUnique({ where: { numeroSocio } });
    if (foundByNumber) return { socio: foundByNumber, strength: "numeroSocio" as const };
  }

  if (dni) {
    const foundByDni = await tx.socio.findUnique({ where: { dni } });
    if (foundByDni) return { socio: foundByDni, strength: "dni" as const };
  }

  const allSocios = await tx.socio.findMany();
  const targetName = normalizeName(`${row.nombre} ${row.apellidos}`);

   const foundByName =
    allSocios.find((socio) => normalizeName([socio.nombre, socio.apellido1, socio.apellido2].filter(Boolean).join(" ")) === targetName) ?? null;

  if (foundByName) {
    return { socio: foundByName, strength: "name" as const };
  }

  return { socio: null, strength: "none" as const };
}

function buildConflictReason(params: {
  rowName: string;
  numeroSocio: string | null;
  dni: string | null;
  strength: MatchStrength;
  matchedSocio?: SocioRecord | null;
}) {
  const { rowName, numeroSocio, dni, strength, matchedSocio } = params;

  if (strength === "name" && matchedSocio) {
    return `${rowName}: coincidencia solo por nombre con ${matchedSocio.numeroSocio}; no se crea ni actualiza sin numeroSocio/DNI consistente`;
  }

  if (!numeroSocio && !dni) {
    return `${rowName}: sin numeroSocio ni DNI; no se crea socio nuevo con match débil`;
  }

  return `${rowName}: conflicto de identificación; revisión manual requerida`;
}

async function getNextNumeroSocio(tx: BatchSyncClient) {
  const socios = await tx.socio.findMany({ select: { numeroSocio: true } });
  const next = socios.reduce((max, socio) => {
    const match = socio.numeroSocio.match(/s-(\d+)/i);
    const current = match ? Number.parseInt(match[1], 10) : 0;
    return Math.max(max, current);
  }, 0) + 1;

  return formatNumeroSocio(next)!;
}

function isSocioSnapshotEqual(existing: SocioRecord, incoming: {
  numeroSocio: string;
  dni: string | null;
  nombre: string;
  apellido1: string | null;
  apellido2: string | null;
  tipoVinculacion: TipoVinculacion;
  fechaNacimiento: Date | null;
  estadoPulsera: EstadoPulsera;
  filada: string | null;
}) {
  return (
    existing.numeroSocio === incoming.numeroSocio &&
    existing.dni === incoming.dni &&
    existing.nombre === incoming.nombre &&
    existing.apellido1 === incoming.apellido1 &&
    existing.apellido2 === incoming.apellido2 &&
    existing.tipoVinculacion === incoming.tipoVinculacion &&
    String(existing.fechaNacimiento ?? "") === String(incoming.fechaNacimiento ?? "") &&
    existing.estadoPulsera === incoming.estadoPulsera &&
    (existing.filada ?? null) === incoming.filada
  );
}

export async function processMassCredit({
  batchKey,
  tipoVinculacion,
  cantidad,
  descripcion,
  noRetornable,
  session,
  client,
}: {
  batchKey?: string | null;
  tipoVinculacion: TipoVinculacion;
  cantidad: number;
  descripcion?: string;
  noRetornable?: boolean;
  session: MoneyActorSession;
  client: BatchSyncClient;
}) {
  const batchClient = getClient(client);
  const amount = parseMoney(cantidad);
  const actor = getActorMetadata(session);
  const socios = await batchClient.socio.findMany({ where: { tipoVinculacion }, select: { id: true, numeroSocio: true } });
  const resolvedBatchKey = deriveBatchKey("mass-credit", {
    tipoVinculacion,
    cantidad: serializeMoney(amount),
    descripcion: descripcion ?? null,
    noRetornable: noRetornable === true,
  }, batchKey);

  let aplicados = 0;
  let omitidos = 0;
  let reintentados = 0;

  for (const socio of socios) {
    const result = await runInTransaction(batchClient, async (tx) =>
      executeIdempotent({
        store: createPrismaIdempotencyStore(tx),
        scope: createIdempotencyScope("mass-credit", socio.id),
        key: resolvedBatchKey,
        payload: {
          cantidad: serializeMoney(amount),
          descripcion: descripcion ?? null,
          noRetornable: noRetornable === true,
        },
        execute: async () => {
          const updatedSocio = await tx.socio.update({
            where: { id: socio.id },
            data: {
              credito: { increment: amount },
              ...(noRetornable ? { creditoNoRetornable: { increment: amount } } : {}),
            },
          });

          const transaction = await tx.transaccion.create({
            data: {
              socioId: socio.id,
              tipo: "carga",
              cantidad: amount,
              descripcion: descripcion ?? null,
              operador: actor.operator,
              puntoVentaId: actor.puntoVentaId,
            },
          });

          return {
            statusCode: 200,
            body: {
              socioId: updatedSocio.id,
              transactionId: transaction.id,
            },
          };
        },
      }),
    );

    if (result.kind === "replay") {
      omitidos += 1;
      reintentados += 1;
      continue;
    }

    aplicados += 1;
  }

  return {
    procesados: socios.length,
    aplicados,
    omitidos,
    reintentados,
    cantidad: moneyToNumber(amount),
  };
}

export async function processMassRefund({
  batchKey,
  socioIds,
  session,
  client,
}: {
  batchKey?: string | null;
  socioIds?: number[];
  session: MoneyActorSession;
  client: BatchSyncClient;
}) {
  const batchClient = getClient(client);
  const actor = getActorMetadata(session);
  const socios = await batchClient.socio.findMany({ where: socioIds ? { id: { in: socioIds } } : undefined });
  const resolvedBatchKey = deriveBatchKey("mass-refund", { socioIds: socioIds ?? null }, batchKey);

  let aplicados = 0;
  let omitidos = 0;
  let reintentados = 0;
  let totalDevuelto = 0;

  for (const socio of socios) {
    const retornable = parseUnknownMoney(socio.credito).minus(parseUnknownMoney(socio.creditoNoRetornable));
    if (retornable.lessThanOrEqualTo(0)) {
      omitidos += 1;
      continue;
    }

    const result = await runInTransaction(batchClient, async (tx) =>
      executeIdempotent({
        store: createPrismaIdempotencyStore(tx),
        scope: createIdempotencyScope("mass-refund", socio.id),
        key: resolvedBatchKey,
        payload: { cantidad: serializeMoney(retornable) },
        execute: async () => {
          await tx.socio.update({
            where: { id: socio.id },
            data: { credito: { decrement: retornable } },
          });

          await tx.transaccion.create({
            data: {
              socioId: socio.id,
              tipo: "devolucion",
              cantidad: retornable,
              descripcion: "Devolución masiva de crédito retornable",
              operador: actor.operator,
              puntoVentaId: actor.puntoVentaId,
            },
          });

          return {
            statusCode: 200,
            body: {
              socioId: socio.id,
              cantidad: serializeMoney(retornable),
            },
          };
        },
      }),
    );

    if (result.kind === "replay") {
      omitidos += 1;
      reintentados += 1;
      continue;
    }

    aplicados += 1;
    totalDevuelto += moneyToNumber(retornable);
  }

  return {
    procesados: aplicados,
    aplicados,
    omitidos,
    reintentados,
    totalDevuelto: Math.round(totalDevuelto * 100) / 100,
  };
}

export async function importGestionRows({
  batchKey,
  rows,
  client,
}: {
  batchKey?: string | null;
  rows: GestionImportRow[];
  client: BatchSyncClient;
}) {
  const batchClient = getClient(client);
  const resolvedBatchKey = deriveBatchKey("gestion-import", rows, batchKey);
  let creados = 0;
  let actualizados = 0;
  let omitidos = 0;
  let reintentados = 0;
  const errores: string[] = [];
  const conflictos: string[] = [];

  for (const row of rows) {
    if (!row.nombre?.trim()) {
      omitidos += 1;
      continue;
    }

    const resourceId = formatNumeroSocio(row.numeroSocio) ?? normalizeDni(row.dni) ?? normalizeName(`${row.nombre}:${row.apellidos}`);

    try {
      const result = await runInTransaction(batchClient, async (tx) =>
        executeIdempotent({
          store: createPrismaIdempotencyStore(tx),
          scope: createIdempotencyScope("gestion-import", resourceId),
          key: resolvedBatchKey,
          payload: row,
          execute: async () => {
            const [apellido1, apellido2] = splitApellidos(row.apellidos || "");
            const fechaNacimiento = row.fechaNacimiento ? new Date(row.fechaNacimiento) : null;
            const dni = normalizeDni(row.dni);
            const sourceNumeroSocio = formatNumeroSocio(row.numeroSocio);
            const numeroSocio = sourceNumeroSocio ?? await getNextNumeroSocio(tx);
            const match = await findExistingSocio(tx, row);
            const existente = match.socio;

            if (existente && match.strength !== "name") {
              await tx.socio.update({
                where: { id: existente.id },
                data: {
                  numeroSocio,
                  dni,
                  nombre: normalizeName(row.nombre),
                  apellido1,
                  apellido2,
                  tipoVinculacion: row.tipoVinculacion as TipoVinculacion,
                  fechaNacimiento,
                  estadoPulsera: row.activo?.trim().toLowerCase() === "true" ? existente.estadoPulsera : "inactiva",
                },
              });

              return {
                statusCode: 200,
                body: { action: "updated" },
              };
            }

            if (match.strength === "name" || (!sourceNumeroSocio && !dni)) {
              return {
                statusCode: 200,
                body: {
                  action: "unchanged",
                  conflict: buildConflictReason({
                    rowName: row.nombre,
                    numeroSocio: sourceNumeroSocio,
                    dni,
                    strength: match.strength,
                    matchedSocio: existente,
                  }),
                },
              };
            }

            await tx.socio.create({
              data: {
                numeroSocio,
                dni,
                nombre: normalizeName(row.nombre),
                apellido1,
                apellido2,
                tipoVinculacion: row.tipoVinculacion as TipoVinculacion,
                fechaNacimiento,
                credito: 0,
                creditoNoRetornable: 0,
                estadoPulsera: row.activo?.trim().toLowerCase() === "true" ? "activa" : "inactiva",
                filada: null,
              },
            });

            return {
              statusCode: 200,
              body: { action: "created" },
            };
          },
        }),
      );

        if (result.kind === "replay") {
          reintentados += 1;
          continue;
        }

        const conflict =
          typeof result.response.body === "object" &&
          result.response.body !== null &&
          "conflict" in result.response.body &&
          typeof result.response.body.conflict === "string"
            ? result.response.body.conflict
            : null;

        if (conflict) {
          omitidos += 1;
          conflictos.push(conflict);
          continue;
        }

        if (readAction(result.response.body) === "created") {
          creados += 1;
      } else {
        actualizados += 1;
      }
    } catch (error) {
      errores.push(`${row.nombre}: ${error instanceof Error ? error.message : "Error"}`);
    }
  }

  return {
    creados,
    actualizados,
    omitidos,
    reintentados,
    conflictos: conflictos.slice(0, 20),
    errores: errores.slice(0, 20),
  };
}

export async function syncGestionMembers({
  gestionSocios,
  filadas,
  activeMemberIds,
  client,
}: {
  gestionSocios: GestionSocioSnapshot[];
  filadas: GestionFiladaSnapshot[];
  activeMemberIds: Set<string>;
  client: BatchSyncClient;
}) {
  const batchClient = getClient(client);
  const resolvedBatchKey = deriveBatchKey("gestion-sync", {
    gestionSocios,
    filadas,
    activeMemberIds: [...activeMemberIds].sort(),
  });
  const filadaMap = new Map(filadas.map((filada) => [filada.id, filada.nombre]));

  let creados = 0;
  let actualizados = 0;
  let desactivados = 0;
  let sinCambios = 0;
  const errores: string[] = [];
  const conflictos: string[] = [];

  for (const socio of gestionSocios) {
    try {
      const result = await runInTransaction(batchClient, async (tx) =>
        executeIdempotent({
          store: createPrismaIdempotencyStore(tx),
          scope: createIdempotencyScope("gestion-sync", socio.id),
          key: resolvedBatchKey,
          payload: socio,
          execute: async () => {
            const match = await findExistingSocio(tx, socio);
            const existente = match.socio;
            const [apellido1, apellido2] = splitApellidos(socio.apellidos || "");
            const sourceNumeroSocio = formatNumeroSocio(socio.numero_socio);
            const sourceDni = normalizeDni(socio.dni);
            const incoming = {
              numeroSocio: sourceNumeroSocio ?? await getNextNumeroSocio(tx),
              dni: sourceDni,
              nombre: normalizeName(socio.nombre),
              apellido1,
              apellido2,
              tipoVinculacion: socio.tipo_vinculacion,
              fechaNacimiento: socio.fecha_nacimiento ? new Date(socio.fecha_nacimiento) : null,
              estadoPulsera: activeMemberIds.has(socio.id) ? "activa" as const : "inactiva" as const,
              filada: socio.filada_id != null ? filadaMap.get(socio.filada_id) ?? null : null,
            };

            if (existente && match.strength !== "name") {
              if (incoming.dni && incoming.dni !== existente.dni) {
                await tx.socio.updateMany({ where: { dni: incoming.dni }, data: { dni: null } });
              }

              if (isSocioSnapshotEqual(existente, incoming)) {
                return { statusCode: 200, body: { action: "unchanged" } };
              }

              await tx.socio.update({
                where: { id: existente.id },
                data: incoming,
              });

              return { statusCode: 200, body: { action: "updated" } };
            }

            if (match.strength === "name" || (!sourceNumeroSocio && !sourceDni)) {
              return {
                statusCode: 200,
                body: {
                  action: "unchanged",
                  conflict: buildConflictReason({
                    rowName: socio.nombre,
                    numeroSocio: sourceNumeroSocio,
                    dni: sourceDni,
                    strength: match.strength,
                    matchedSocio: existente,
                  }),
                },
              };
            }

            if (incoming.dni) {
              await tx.socio.updateMany({ where: { dni: incoming.dni }, data: { dni: null } });
            }

            await tx.socio.create({
              data: {
                ...incoming,
                credito: 0,
                creditoNoRetornable: 0,
              },
            });

            return { statusCode: 200, body: { action: "created" } };
          },
        }),
      );

      const conflict =
        result.kind !== "replay" &&
        typeof result.response.body === "object" &&
        result.response.body !== null &&
        "conflict" in result.response.body &&
        typeof result.response.body.conflict === "string"
          ? result.response.body.conflict
          : null;

      if (conflict) {
        sinCambios += 1;
        conflictos.push(conflict);
        continue;
      }

      const action = result.kind === "replay" ? "unchanged" : readAction(result.response.body);
      if (action === "created") creados += 1;
      else if (action === "updated") actualizados += 1;
      else sinCambios += 1;
    } catch (error) {
      errores.push(`${socio.nombre}: ${error instanceof Error ? error.message : "Error"}`);
    }
  }

  const gestionNumbers = new Set(
    gestionSocios.map((socio) => socio.numero_socio).filter((value): value is number => value !== null),
  );
  const activosQr = await batchClient.socio.findMany({ where: { estadoPulsera: "activa" } });

  for (const socio of activosQr) {
    const match = socio.numeroSocio.match(/s-(\d+)/i);
    const numero = match ? Number.parseInt(match[1], 10) : -1;
    if (!gestionNumbers.has(numero) && moneyToNumber(parseUnknownMoney(socio.credito)) <= 0) {
      await batchClient.socio.update({ where: { id: socio.id }, data: { estadoPulsera: "inactiva" } });
      desactivados += 1;
    }
  }

  return {
    creados,
    actualizados,
    desactivados,
    sinCambios,
    noEncontrados: 0,
    conflictos: conflictos.slice(0, 20),
    errores: errores.slice(0, 20),
  };
}
