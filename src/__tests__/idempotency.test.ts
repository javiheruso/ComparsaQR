import { describe, expect, it } from "vitest";

import {
  IdempotencyConflictError,
  InMemoryIdempotencyStore,
  canonicalizePayload,
  createPrismaIdempotencyStore,
  createIdempotencyScope,
  executeIdempotent,
} from "@/lib/idempotency";

describe("idempotency foundation", () => {
  it("reuses the original outcome for the same scope, key, and payload", async () => {
    const store = new InMemoryIdempotencyStore();
    let executions = 0;

    const first = await executeIdempotent({
      store,
      scope: createIdempotencyScope("member-credit", 9),
      key: "load-1",
      payload: { cantidad: "10.00", descripcion: "Carga" },
      execute: async () => {
        executions += 1;
        return {
          statusCode: 200,
          body: { credito: "45.00", transaccionId: 11 },
        };
      },
    });

    const replay = await executeIdempotent({
      store,
      scope: createIdempotencyScope("member-credit", 9),
      key: "load-1",
      payload: { descripcion: "Carga", cantidad: "10.00" },
      execute: async () => {
        executions += 1;
        return {
          statusCode: 200,
          body: { credito: "999.00", transaccionId: 99 },
        };
      },
    });

    expect(first.kind).toBe("created");
    expect(replay.kind).toBe("replay");
    expect(replay.response).toEqual(first.response);
    expect(executions).toBe(1);
  });

  it("rejects the same key when the payload fingerprint changes", async () => {
    const store = new InMemoryIdempotencyStore();

    await executeIdempotent({
      store,
      scope: createIdempotencyScope("member-credit", 9),
      key: "load-1",
      payload: { cantidad: "10.00" },
      execute: async () => ({
        statusCode: 200,
        body: { credito: "45.00" },
      }),
    });

    await expect(
      executeIdempotent({
        store,
        scope: createIdempotencyScope("member-credit", 9),
        key: "load-1",
        payload: { cantidad: "11.00" },
        execute: async () => ({
          statusCode: 200,
          body: { credito: "46.00" },
        }),
      })
    ).rejects.toBeInstanceOf(IdempotencyConflictError);
  });

  it("canonicalizes payload hashes independently of object key order", () => {
    expect(
      canonicalizePayload({ b: 2, a: { d: 4, c: 3 } })
    ).toBe('{"a":{"c":3,"d":4},"b":2}');
  });

  it("adapts the foundation to a Prisma-style record delegate", async () => {
    const delegate = {
      findUnique: async () => null,
      create: async ({ data }: { data: { scope: string; key: string; requestHash: string; status: string } }) => ({
        ...data,
        responseCode: null,
        responseBody: null,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      }),
      update: async ({
        where,
        data,
      }: {
        where: { scope_key: { scope: string; key: string } };
        data: { status: string; responseCode: number; responseBody: { credito: string } };
      }) => ({
        scope: where.scope_key.scope,
        key: where.scope_key.key,
        requestHash: "hash",
        status: data.status,
        responseCode: data.responseCode,
        responseBody: data.responseBody,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-01T00:01:00.000Z"),
      }),
    };

    const store = createPrismaIdempotencyStore({ idempotencyRecord: delegate });
    await store.createPending({ scope: "member-credit:9", key: "abc", requestHash: "hash" });
    const completed = await store.markCompleted("member-credit:9", "abc", {
      statusCode: 200,
      body: { credito: "45.00" },
    });

    expect(completed.status).toBe("completed");
    expect(completed.response).toEqual({
      statusCode: 200,
      body: { credito: "45.00" },
    });
  });
});
