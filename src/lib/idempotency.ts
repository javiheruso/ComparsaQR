import { createHash } from "node:crypto";
import { Prisma } from "@/generated/prisma/client";
import type { PrismaClient } from "@/generated/prisma/client";

export type JsonValue = Prisma.JsonValue;
type JsonObject = Prisma.JsonObject;

export interface IdempotencyResponse<TBody extends JsonValue = JsonValue> {
  statusCode: number;
  body: TBody;
}

export interface IdempotencyRecord<TBody extends JsonValue = JsonValue> {
  scope: string;
  key: string;
  requestHash: string;
  status: "pending" | "completed";
  response: IdempotencyResponse<TBody> | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface IdempotencyStore<TBody extends JsonValue = JsonValue> {
  find(scope: string, key: string): Promise<IdempotencyRecord<TBody> | null>;
  createPending(record: Pick<IdempotencyRecord<TBody>, "scope" | "key" | "requestHash">): Promise<IdempotencyRecord<TBody>>;
  markCompleted(scope: string, key: string, response: IdempotencyResponse<TBody>): Promise<IdempotencyRecord<TBody>>;
}

interface PrismaIdempotencyRecordRow {
  scope: string;
  key: string;
  requestHash: string;
  status: string;
  responseCode: number | null;
  responseBody: JsonValue | null;
  createdAt: Date;
  updatedAt: Date;
}

export class IdempotencyConflictError extends Error {
  readonly statusCode = 409;

  constructor(message = "Idempotency key already used with a different payload") {
    super(message);
    this.name = "IdempotencyConflictError";
  }
}

export class IdempotencyInProgressError extends Error {
  readonly statusCode = 409;

  constructor(message = "Idempotency key is already in progress") {
    super(message);
    this.name = "IdempotencyInProgressError";
  }
}

export class IdempotencyAlreadyExistsError extends Error {
  constructor() {
    super("Idempotency record already exists");
    this.name = "IdempotencyAlreadyExistsError";
  }
}

function isPlainObject(value: JsonValue): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toPrismaJsonInput(value: JsonValue): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput {
  if (value === null) {
    return Prisma.JsonNull;
  }

  return value as Prisma.InputJsonValue;
}

export function canonicalizePayload(payload: JsonValue): string {
  if (Array.isArray(payload)) {
    return `[${payload.map(canonicalizePayload).join(",")}]`;
  }

  if (isPlainObject(payload)) {
    const entries = Object.keys(payload)
      .sort()
      .flatMap((key) => {
        const value = payload[key];
        return value === undefined
          ? []
          : [`${JSON.stringify(key)}:${canonicalizePayload(value)}`];
      });

    return `{${entries.join(",")}}`;
  }

  return JSON.stringify(payload);
}

export function hashIdempotencyPayload(payload: JsonValue): string {
  return createHash("sha256").update(canonicalizePayload(payload)).digest("hex");
}

export function createIdempotencyScope(command: string, resourceId: string | number): string {
  return `${command}:${resourceId}`;
}

export class InMemoryIdempotencyStore implements IdempotencyStore {
  private readonly records = new Map<string, IdempotencyRecord>();

  async find(scope: string, key: string): Promise<IdempotencyRecord | null> {
    return this.records.get(`${scope}::${key}`) ?? null;
  }

  async createPending(record: Pick<IdempotencyRecord, "scope" | "key" | "requestHash">): Promise<IdempotencyRecord> {
    const id = `${record.scope}::${record.key}`;
    if (this.records.has(id)) {
      throw new IdempotencyAlreadyExistsError();
    }

    const now = new Date();
    const created: IdempotencyRecord = {
      ...record,
      status: "pending",
      response: null,
      createdAt: now,
      updatedAt: now,
    };

    this.records.set(id, created);
    return created;
  }

  async markCompleted(scope: string, key: string, response: IdempotencyResponse): Promise<IdempotencyRecord> {
    const id = `${scope}::${key}`;
    const existing = this.records.get(id);

    if (!existing) {
      throw new Error("Cannot complete missing idempotency record");
    }

    const completed: IdempotencyRecord = {
      ...existing,
      status: "completed",
      response,
      updatedAt: new Date(),
    };

    this.records.set(id, completed);
    return completed;
  }
}

function mapRecord(row: PrismaIdempotencyRecordRow): IdempotencyRecord {
  return {
    scope: row.scope,
    key: row.key,
    requestHash: row.requestHash,
    status: row.status === "completed" ? "completed" : "pending",
    response:
      row.responseCode === null || row.responseBody === null
        ? null
        : {
            statusCode: row.responseCode,
            body: row.responseBody,
          },
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function createPrismaIdempotencyStore(client: Pick<PrismaClient, "idempotencyRecord">): IdempotencyStore {
  return {
    async find(scope, key) {
      const record = await client.idempotencyRecord.findUnique({
        where: { scope_key: { scope, key } },
      });

      return record ? mapRecord(record) : null;
    },
    async createPending(record) {
      try {
        const created = await client.idempotencyRecord.create({
          data: {
            scope: record.scope,
            key: record.key,
            requestHash: record.requestHash,
            status: "pending",
          },
        });

        return mapRecord(created);
      } catch (error) {
        if (
          typeof error === "object" &&
          error !== null &&
          "code" in error &&
          error.code === "P2002"
        ) {
          throw new IdempotencyAlreadyExistsError();
        }

        throw error;
      }
    },
    async markCompleted(scope, key, response) {
      const updated = await client.idempotencyRecord.update({
        where: { scope_key: { scope, key } },
        data: {
          status: "completed",
          responseCode: response.statusCode,
          responseBody: toPrismaJsonInput(response.body),
        },
      });

      return mapRecord(updated);
    },
  };
}

export async function executeIdempotent<TBody extends JsonValue>({
  store,
  scope,
  key,
  payload,
  execute,
}: {
  store: IdempotencyStore<TBody>;
  scope: string;
  key: string;
  payload: TBody;
  execute: () => Promise<IdempotencyResponse<TBody>>;
}): Promise<
  | { kind: "created"; response: IdempotencyResponse<TBody> }
  | { kind: "replay"; response: IdempotencyResponse<TBody> }
> {
  const requestHash = hashIdempotencyPayload(payload);

  const reuseExisting = async () => {
    const existing = await store.find(scope, key);

    if (!existing) {
      return null;
    }

    if (existing.requestHash !== requestHash) {
      throw new IdempotencyConflictError();
    }

    if (existing.status !== "completed" || !existing.response) {
      throw new IdempotencyInProgressError();
    }

    return { kind: "replay" as const, response: existing.response };
  };

  const existing = await reuseExisting();
  if (existing) {
    return existing;
  }

  try {
    await store.createPending({ scope, key, requestHash });
  } catch (error) {
    if (error instanceof IdempotencyAlreadyExistsError) {
      const replay = await reuseExisting();
      if (replay) {
        return replay;
      }
    }
    throw error;
  }

  const response = await execute();
  await store.markCompleted(scope, key, response);

  return { kind: "created", response };
}
