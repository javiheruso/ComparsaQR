import { Decimal } from "@prisma/client/runtime/client";

import type { SessionData } from "@/lib/auth";
import { getActorContext } from "@/lib/access";
import {
  createIdempotencyScope,
  createPrismaIdempotencyStore,
  executeIdempotent,
  type IdempotencyResponse,
  type JsonValue,
} from "@/lib/idempotency";
import {
  chargeGuest as chargeGuestBalance,
  getGuestProfile,
  isGuestId,
  type GuestProfile,
  type GuestStoreClient,
} from "@/lib/guest-store";
import { db } from "@/lib/db";
import { moneyToNumber, parseMoney, serializeMoney } from "@/lib/money";

type MoneyActorSession = Partial<SessionData> | null | undefined;

type MemberRecord = {
  id: number;
  nombre: string;
  numeroSocio: string;
  credito: Decimal | number | string;
  creditoNoRetornable: Decimal | number | string;
  estadoPulsera: "activa" | "inactiva" | "perdida" | string;
};

type GuestSessionRecord = {
  id: number;
  balance: Decimal | number | string;
  lastChargeAt: Date | null;
};

type ProductRecord = {
  id: number;
  nombre: string;
  precio: Decimal | number | string;
};

type MoneyTransactionRecord = {
  id: number;
};

type MoneyDbClient = GuestStoreClient & {
  socio: {
    findUnique(args: {
      where: { id: number };
      select?: Record<string, boolean>;
    }): Promise<MemberRecord | Pick<MemberRecord, "creditoNoRetornable"> | null>;
    update(args: {
      where: { id: number };
      data: { credito?: { increment?: Decimal; decrement?: Decimal } };
    }): Promise<MemberRecord>;
    updateMany(args: {
      where: { id: number; estadoPulsera?: string; credito?: { gte: Decimal } };
      data: {
        credito?: { decrement?: Decimal };
        creditoNoRetornable?: { decrement?: Decimal };
      };
    }): Promise<{ count: number }>;
  };
  producto: {
    findMany(args: {
      where: { id: { in: number[] } };
      select?: Record<string, boolean>;
    }): Promise<ProductRecord[]>;
  };
  transaccion: {
    create(args: {
      data: {
        socioId: number;
        tipo: "carga" | "consumo" | "devolucion";
        cantidad: Decimal;
        descripcion: string | null;
        operador: string | null;
        puntoVentaId: number | null;
      };
    }): Promise<MoneyTransactionRecord>;
  };
  idempotencyRecord: Parameters<typeof createPrismaIdempotencyStore>[0]["idempotencyRecord"];
  $transaction?<T>(callback: (tx: MoneyDbClient) => Promise<T>): Promise<T>;
};

type MoneyResponse = {
  id: number;
  nombre: string;
  numeroSocio: string;
  credito: number;
  creditoNoRetornable?: number;
  estadoPulsera: string;
  meta: {
    idempotency: {
      key: string | null;
      replayed: boolean;
    };
    operator: string | null;
    puntoVentaId: number | null;
    transactionId: number | null;
    transactionType: "carga" | "consumo" | "devolucion";
  };
};

export class MoneyCommandError extends Error {
  readonly statusCode: number;
  readonly details?: unknown;

  constructor(message: string, statusCode: number, details?: unknown) {
    super(message);
    this.name = "MoneyCommandError";
    this.statusCode = statusCode;
    this.details = details;
  }
}

function getMoneyClient(client?: MoneyDbClient): MoneyDbClient {
  return client ?? (db as MoneyDbClient);
}

function getActorMetadata(session: MoneyActorSession) {
  const actor = getActorContext(session);

  return {
    operator:
      actor.actorType === "admin"
        ? "admin"
        : actor.actorType === "punto"
          ? session?.puntoNombre ?? "punto"
          : actor.actorType === "scanner"
            ? "scanner"
            : null,
    puntoVentaId: session?.puntoVentaId ?? null,
  };
}

function createResponseMeta({
  idempotencyKey,
  replayed,
  operator,
  puntoVentaId,
  transactionId,
  transactionType,
}: {
  idempotencyKey: string | null;
  replayed: boolean;
  operator: string | null;
  puntoVentaId: number | null;
  transactionId: number | null;
  transactionType: "carga" | "consumo" | "devolucion";
}) {
  return {
    idempotency: {
      key: idempotencyKey,
      replayed,
    },
    operator,
    puntoVentaId,
    transactionId,
    transactionType,
  };
}

function mapMemberResponse(member: MemberRecord, meta: MoneyResponse["meta"]): MoneyResponse {
  return {
    id: member.id,
    nombre: member.nombre,
    numeroSocio: member.numeroSocio,
    credito: moneyToNumber(member.credito),
    creditoNoRetornable: moneyToNumber(member.creditoNoRetornable),
    estadoPulsera: member.estadoPulsera,
    meta,
  };
}

function mapGuestResponse(guest: GuestProfile, meta: MoneyResponse["meta"]): MoneyResponse {
  return {
    id: guest.id,
    nombre: guest.nombre,
    numeroSocio: guest.numeroSocio,
    credito: guest.credito,
    estadoPulsera: guest.estadoPulsera,
    meta,
  };
}

function withReplayFlag(body: MoneyResponse, replayed: boolean): MoneyResponse {
  return {
    ...body,
    meta: {
      ...body.meta,
      idempotency: {
        ...body.meta.idempotency,
        replayed,
      },
    },
  };
}

async function runInTransaction<T>(
  client: MoneyDbClient,
  operation: (tx: MoneyDbClient) => Promise<T>,
): Promise<T> {
  if (client.$transaction) {
    return client.$transaction(operation);
  }

  return operation(client);
}

async function executeMoneyMutation({
  client,
  command,
  resourceId,
  idempotencyKey,
  payload,
  execute,
}: {
  client: MoneyDbClient;
  command: string;
  resourceId: number;
  idempotencyKey?: string | null;
  payload: JsonValue;
  execute: (tx: MoneyDbClient) => Promise<IdempotencyResponse<MoneyResponse>>;
}): Promise<IdempotencyResponse<MoneyResponse>> {
  const normalizedKey = idempotencyKey?.trim() ? idempotencyKey.trim() : null;

  if (!normalizedKey) {
    return runInTransaction(client, execute);
  }

  const scope = createIdempotencyScope(command, resourceId);

  const result = await runInTransaction(client, async (tx) =>
    executeIdempotent({
      store: createPrismaIdempotencyStore(tx),
      scope,
      key: normalizedKey,
      payload,
      execute: () => execute(tx),
    }),
  );

  const body = result.response.body;
  if (
    typeof body !== "object" ||
    body === null ||
    !("id" in body) ||
    !("nombre" in body) ||
    !("numeroSocio" in body) ||
    !("credito" in body) ||
    !("estadoPulsera" in body) ||
    !("meta" in body)
  ) {
    throw new Error("Invalid idempotency response body");
  }

  return {
    statusCode: result.response.statusCode,
    body: withReplayFlag(body as MoneyResponse, result.kind === "replay"),
  };
}

function buildConsumptionDetails(items: Array<{ productoId: number; cantidad: number }>, products: ProductRecord[]) {
  const productsById = new Map(products.map((product) => [product.id, product]));

  if (products.length !== new Set(items.map((item) => item.productoId)).size) {
    throw new MoneyCommandError("Producto no encontrado", 400);
  }

  const total = items.reduce((sum, item) => {
    const product = productsById.get(item.productoId);
    if (!product) {
      throw new MoneyCommandError("Producto no encontrado", 400);
    }

    return sum.plus(parseMoney(product.precio).mul(item.cantidad));
  }, new Decimal(0));

  if (total.lessThanOrEqualTo(0)) {
    throw new MoneyCommandError("Importe no válido", 400);
  }

  const description = items
    .map((item) => {
      const product = productsById.get(item.productoId);
      return `${product?.nombre ?? "Producto"} x${item.cantidad}`;
    })
    .join(", ");

  return {
    total: parseMoney(total),
    description,
  };
}

export async function creditMember({
  socioId,
  cantidad,
  descripcion,
  session,
  idempotencyKey,
  client,
}: {
  socioId: number;
  cantidad: number;
  descripcion?: string | null;
  session: MoneyActorSession;
  idempotencyKey?: string | null;
  client?: MoneyDbClient;
}) {
  const moneyClient = getMoneyClient(client);
  const amount = parseMoney(cantidad);
  const actor = getActorMetadata(session);

  return executeMoneyMutation({
    client: moneyClient,
    command: "member-credit",
    resourceId: socioId,
    idempotencyKey,
    payload: {
      cantidad: serializeMoney(amount),
      descripcion: descripcion ?? null,
    },
    execute: async (tx) => {
      const socio = await tx.socio.findUnique({ where: { id: socioId } }) as MemberRecord | null;

      if (!socio) {
        throw new MoneyCommandError("Socio no encontrado", 404);
      }

      if (socio.estadoPulsera !== "activa") {
        throw new MoneyCommandError("No se puede recargar a un socio inactivo", 403);
      }

      const updatedMember = await tx.socio.update({
        where: { id: socioId },
        data: { credito: { increment: amount } },
      });

      const transaction = await tx.transaccion.create({
        data: {
          socioId,
          tipo: "carga",
          cantidad: amount,
          descripcion: descripcion ?? null,
          operador: actor.operator,
          puntoVentaId: actor.puntoVentaId,
        },
      });

      return {
        statusCode: 200,
        body: mapMemberResponse(
          updatedMember,
          createResponseMeta({
            idempotencyKey: idempotencyKey?.trim() || null,
            replayed: false,
            operator: actor.operator,
            puntoVentaId: actor.puntoVentaId,
            transactionId: transaction.id,
            transactionType: "carga",
          }),
        ),
      };
    },
  });
}

export async function chargeMember({
  socioId,
  items,
  session,
  idempotencyKey,
  client,
}: {
  socioId: number;
  items: Array<{ productoId: number; cantidad: number }>;
  session: MoneyActorSession;
  idempotencyKey?: string | null;
  client?: MoneyDbClient;
}) {
  const moneyClient = getMoneyClient(client);
  const actor = getActorMetadata(session);

  return executeMoneyMutation({
    client: moneyClient,
    command: isGuestId(socioId) ? "guest-charge" : "member-charge",
    resourceId: socioId,
    idempotencyKey,
    payload: {
      items: items.map((item) => ({ productoId: item.productoId, cantidad: item.cantidad })),
    },
    execute: async (tx) => {
      const products = await tx.producto.findMany({
        where: { id: { in: items.map((item) => item.productoId) } },
      });

      const { total, description } = buildConsumptionDetails(items, products);

      if (isGuestId(socioId)) {
        const chargedGuest = await chargeGuestBalance(total, {
          client: tx,
        });

        if (!chargedGuest.ok) {
          const guest = await getGuestProfile(tx);
          throw new MoneyCommandError("Crédito insuficiente", 400, {
            creditoActual: guest.credito,
          });
        }

        return {
          statusCode: 200,
          body: mapGuestResponse(
            chargedGuest.profile,
            createResponseMeta({
              idempotencyKey: idempotencyKey?.trim() || null,
              replayed: false,
              operator: actor.operator,
              puntoVentaId: actor.puntoVentaId,
              transactionId: chargedGuest.transactionId,
              transactionType: "consumo",
            }),
          ),
        };
      }

      const socio = await tx.socio.findUnique({ where: { id: socioId } }) as MemberRecord | null;

      if (!socio) {
        throw new MoneyCommandError("Socio no encontrado", 404);
      }

      if (socio.estadoPulsera !== "activa") {
        throw new MoneyCommandError("Pulsera desactivada", 403);
      }

      if (parseMoney(socio.credito).lessThan(total)) {
        throw new MoneyCommandError("Crédito insuficiente", 400, {
          creditoActual: moneyToNumber(socio.credito),
        });
      }

      const current = await tx.socio.findUnique({
        where: { id: socioId },
        select: { creditoNoRetornable: true },
      }) as Pick<MemberRecord, "creditoNoRetornable"> | null;

      if (!current) {
        throw new MoneyCommandError("Socio no encontrado", 404);
      }

      const currentNoRetornable = parseMoney(current.creditoNoRetornable);
      const decrementNoRetornable = currentNoRetornable.lessThan(total)
        ? currentNoRetornable
        : total;

      const update = await tx.socio.updateMany({
        where: {
          id: socioId,
          estadoPulsera: "activa",
          credito: { gte: total },
        },
        data: {
          credito: { decrement: total },
          creditoNoRetornable: { decrement: decrementNoRetornable },
        },
      });

      if (update.count !== 1) {
        throw new MoneyCommandError(
          "No se pudo completar el cobro. Revisa el crédito o el estado de la pulsera.",
          409,
        );
      }

      const transaction = await tx.transaccion.create({
        data: {
          socioId,
          tipo: "consumo",
          cantidad: total,
          descripcion: description,
          operador: actor.operator,
          puntoVentaId: actor.puntoVentaId,
        },
      });

      const updatedMember = await tx.socio.findUnique({ where: { id: socioId } }) as MemberRecord | null;

      if (!updatedMember) {
        throw new MoneyCommandError("Socio no encontrado", 404);
      }

      return {
        statusCode: 200,
        body: mapMemberResponse(
          updatedMember,
          createResponseMeta({
            idempotencyKey: idempotencyKey?.trim() || null,
            replayed: false,
            operator: actor.operator,
            puntoVentaId: actor.puntoVentaId,
            transactionId: transaction.id,
            transactionType: "consumo",
          }),
        ),
      };
    },
  });
}

export async function refundMember({
  socioId,
  cantidad,
  session,
  idempotencyKey,
  client,
}: {
  socioId: number;
  cantidad: number;
  session: MoneyActorSession;
  idempotencyKey?: string | null;
  client?: MoneyDbClient;
}) {
  const moneyClient = getMoneyClient(client);
  const amount = parseMoney(cantidad);
  const actor = getActorMetadata(session);

  return executeMoneyMutation({
    client: moneyClient,
    command: "member-refund",
    resourceId: socioId,
    idempotencyKey,
    payload: {
      cantidad: serializeMoney(amount),
    },
    execute: async (tx) => {
      const socio = await tx.socio.findUnique({ where: { id: socioId } }) as MemberRecord | null;

      if (!socio) {
        throw new MoneyCommandError("Socio no encontrado", 404);
      }

      const returnable = parseMoney(socio.credito).minus(parseMoney(socio.creditoNoRetornable));

      if (amount.greaterThan(returnable)) {
        throw new MoneyCommandError("La cantidad a devolver supera el saldo retornable", 400, {
          retornable: moneyToNumber(returnable),
          credito: moneyToNumber(socio.credito),
          creditoNoRetornable: moneyToNumber(socio.creditoNoRetornable),
        });
      }

      const updatedMember = await tx.socio.update({
        where: { id: socioId },
        data: { credito: { decrement: amount } },
      });

      const transaction = await tx.transaccion.create({
        data: {
          socioId,
          tipo: "devolucion",
          cantidad: amount,
          descripcion: "Devolución de crédito retornable",
          operador: actor.operator,
          puntoVentaId: actor.puntoVentaId,
        },
      });

      return {
        statusCode: 200,
        body: mapMemberResponse(
          updatedMember,
          createResponseMeta({
            idempotencyKey: idempotencyKey?.trim() || null,
            replayed: false,
            operator: actor.operator,
            puntoVentaId: actor.puntoVentaId,
            transactionId: transaction.id,
            transactionType: "devolucion",
          }),
        ),
      };
    },
  });
}
