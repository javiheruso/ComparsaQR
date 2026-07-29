import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  getSession: vi.fn(),
}));

const dbMock = vi.hoisted(() => {
  const idempotencyRecords = new Map<string, {
    scope: string;
    key: string;
    requestHash: string;
    status: string;
    responseCode: number | null;
    responseBody: Record<string, unknown> | null;
    createdAt: Date;
    updatedAt: Date;
  }>();

  const state = {
    socio: {
      id: 9,
      nombre: "Ada",
      numeroSocio: "S-009",
      estadoPulsera: "activa",
      credito: 30,
      creditoNoRetornable: 5,
    },
    guestSession: {
      id: 1,
      balance: 9.9,
      lastChargeAt: null as Date | null,
    },
    productos: [
      { id: 3, nombre: "Agua", precio: 2.5 },
      { id: 4, nombre: "Tapa", precio: 1.2 },
    ],
    transacciones: [] as Array<Record<string, unknown>>,
    nextTransaccionId: 1,
  };

  const toMoneyNumber = (value: unknown) => {
    const numeric = typeof value === "number" ? value : Number(String(value));
    return Math.round(numeric * 100) / 100;
  };

  const addMoney = (current: number, delta: unknown) =>
    Math.round((current + toMoneyNumber(delta)) * 100) / 100;

  const subtractMoney = (current: number, delta: unknown) =>
    Math.round((current - toMoneyNumber(delta)) * 100) / 100;

  const cloneSocio = () => ({
    ...state.socio,
    credito: state.socio.credito,
    creditoNoRetornable: state.socio.creditoNoRetornable,
  });

  const cloneGuestSession = () => ({
    ...state.guestSession,
    balance: state.guestSession.balance,
  });

  const pick = <T extends Record<string, unknown>>(record: T, select?: Record<string, boolean>) => {
    if (!select) {
      return record;
    }

    return Object.fromEntries(
      Object.keys(select)
        .filter((key) => select[key])
        .map((key) => [key, record[key]])
    );
  };

  const db = {
    __reset() {
      idempotencyRecords.clear();
      state.socio.credito = 30;
      state.socio.creditoNoRetornable = 5;
      state.socio.estadoPulsera = "activa";
      state.guestSession.balance = 9.9;
      state.guestSession.lastChargeAt = null;
      state.transacciones.length = 0;
      state.nextTransaccionId = 1;
    },
    __state: state,
    socio: {
      findUnique: vi.fn(async ({ where, select }: { where: { id: number }; select?: Record<string, boolean> }) => {
        if (where.id !== state.socio.id) {
          return null;
        }

        return pick(cloneSocio(), select);
      }),
      update: vi.fn(async ({ where, data }: { where: { id: number }; data: { credito?: { increment?: unknown; decrement?: unknown } } }) => {
        if (where.id !== state.socio.id) {
          throw new Error("Socio not found");
        }

        if (data.credito?.increment !== undefined) {
          state.socio.credito = addMoney(state.socio.credito, data.credito.increment);
        }

        if (data.credito?.decrement !== undefined) {
          state.socio.credito = subtractMoney(state.socio.credito, data.credito.decrement);
        }

        return cloneSocio();
      }),
      updateMany: vi.fn(async ({ where, data }: {
        where: { id: number; estadoPulsera?: string; credito?: { gte: unknown } };
        data: { credito?: { decrement?: unknown }; creditoNoRetornable?: { decrement?: unknown } };
      }) => {
        const hasEnoughCredit = where.credito?.gte === undefined
          ? true
          : state.socio.credito >= toMoneyNumber(where.credito.gte);
        const matches =
          where.id === state.socio.id &&
          (where.estadoPulsera === undefined || where.estadoPulsera === state.socio.estadoPulsera) &&
          hasEnoughCredit;

        if (!matches) {
          return { count: 0 };
        }

        if (data.credito?.decrement !== undefined) {
          state.socio.credito = subtractMoney(state.socio.credito, data.credito.decrement);
        }

        if (data.creditoNoRetornable?.decrement !== undefined) {
          state.socio.creditoNoRetornable = subtractMoney(
            state.socio.creditoNoRetornable,
            data.creditoNoRetornable.decrement
          );
        }

        return { count: 1 };
      }),
    },
    producto: {
      findMany: vi.fn(async ({ where }: { where: { id: { in: number[] } } }) =>
        state.productos.filter((producto) => where.id.in.includes(producto.id)).map((producto) => ({ ...producto }))
      ),
    },
    transaccion: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const transaccion = { id: state.nextTransaccionId++, ...data };
        state.transacciones.push(transaccion);
        return transaccion;
      }),
    },
    guestSession: {
      findUnique: vi.fn(async ({ where }: { where: { id: number } }) =>
        where.id === state.guestSession.id ? cloneGuestSession() : null
      ),
      create: vi.fn(async ({ data }: { data: { id: number; balance: unknown; lastChargeAt: Date | null } }) => {
        state.guestSession.id = data.id;
        state.guestSession.balance = toMoneyNumber(data.balance);
        state.guestSession.lastChargeAt = data.lastChargeAt;
        return cloneGuestSession();
      }),
      update: vi.fn(async ({ where, data }: {
        where: { id: number };
        data: { balance?: unknown | { decrement: unknown }; lastChargeAt?: Date | null };
      }) => {
        if (where.id !== state.guestSession.id) {
          throw new Error("Guest session not found");
        }

        if (typeof data.balance === "object" && data.balance !== null && "decrement" in data.balance) {
          state.guestSession.balance = subtractMoney(state.guestSession.balance, data.balance.decrement);
        } else if (data.balance !== undefined) {
          state.guestSession.balance = toMoneyNumber(data.balance);
        }

        if (data.lastChargeAt !== undefined) {
          state.guestSession.lastChargeAt = data.lastChargeAt;
        }

        return cloneGuestSession();
      }),
    },
    idempotencyRecord: {
      findUnique: vi.fn(async ({ where }: { where: { scope_key: { scope: string; key: string } } }) => {
        const record = idempotencyRecords.get(`${where.scope_key.scope}::${where.scope_key.key}`);
        return record ? { ...record } : null;
      }),
      create: vi.fn(async ({ data }: { data: { scope: string; key: string; requestHash: string; status: string } }) => {
        const id = `${data.scope}::${data.key}`;
        if (idempotencyRecords.has(id)) {
          throw { code: "P2002" };
        }

        const record = {
          ...data,
          responseCode: null,
          responseBody: null,
          createdAt: new Date("2026-07-29T00:00:00.000Z"),
          updatedAt: new Date("2026-07-29T00:00:00.000Z"),
        };
        idempotencyRecords.set(id, record);
        return { ...record };
      }),
      update: vi.fn(async ({ where, data }: {
        where: { scope_key: { scope: string; key: string } };
        data: { status: string; responseCode: number; responseBody: Record<string, unknown> };
      }) => {
        const id = `${where.scope_key.scope}::${where.scope_key.key}`;
        const existing = idempotencyRecords.get(id);

        if (!existing) {
          throw new Error("Missing idempotency record");
        }

        const updated = {
          ...existing,
          ...data,
          updatedAt: new Date("2026-07-29T00:01:00.000Z"),
        };
        idempotencyRecords.set(id, updated);
        return { ...updated };
      }),
    },
    $transaction: vi.fn(async <T>(callback: (tx: typeof db) => Promise<T>) => callback(db)),
  };

  return db;
});

vi.mock("@/lib/auth", () => authMocks);
vi.mock("@/lib/db", () => ({ db: dbMock }));

describe("member money routes", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    dbMock.__reset();
  });

  it("credits a member through the shared money command and returns normalized metadata", async () => {
    authMocks.getSession.mockResolvedValue({
      actorType: "punto",
      actorId: "punto:7",
      puntoPermiso: "caja",
      puntoVentaId: 7,
      puntoNombre: "Caja Norte",
      sessionVersion: 1,
    });

    const { POST } = await import("@/app/api/socios/[id]/credito/route");
    const response = await POST(
      new Request("http://localhost/api/socios/9/credito", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-idempotency-key": "credit-1",
        },
        body: JSON.stringify({ cantidad: 10, descripcion: "Carga inicial" }),
      }),
      { params: Promise.resolve({ id: "9" }) }
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      id: 9,
      nombre: "Ada",
      numeroSocio: "S-009",
      credito: 40,
      creditoNoRetornable: 5,
      estadoPulsera: "activa",
      meta: {
        idempotency: { key: "credit-1", replayed: false },
        operator: "Caja Norte",
        puntoVentaId: 7,
        transactionId: 1,
        transactionType: "carga",
      },
    });
  });

  it("replays the original credit outcome without duplicating the transaction", async () => {
    authMocks.getSession.mockResolvedValue({
      actorType: "punto",
      actorId: "punto:7",
      puntoPermiso: "caja",
      puntoVentaId: 7,
      puntoNombre: "Caja Norte",
      sessionVersion: 1,
    });

    const { POST } = await import("@/app/api/socios/[id]/credito/route");

    const request = () => POST(
      new Request("http://localhost/api/socios/9/credito", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-idempotency-key": "credit-replay",
        },
        body: JSON.stringify({ cantidad: 10, descripcion: "Carga inicial" }),
      }),
      { params: Promise.resolve({ id: "9" }) }
    );

    const firstResponse = await request();
    const replayResponse = await request();

    expect(firstResponse.status).toBe(200);
    expect(replayResponse.status).toBe(200);
    await expect(replayResponse.json()).resolves.toMatchObject({
      credito: 40,
      meta: {
        idempotency: { key: "credit-replay", replayed: true },
        transactionId: 1,
      },
    });
    expect(dbMock.transaccion.create).toHaveBeenCalledTimes(1);
    expect(dbMock.__state.socio.credito).toBe(40);
  });

  it("charges a member without float drift through the shared command layer", async () => {
    authMocks.getSession.mockResolvedValue({
      actorType: "scanner",
      actorId: "scanner",
      sessionVersion: 1,
    });

    const { POST } = await import("@/app/api/socios/[id]/consumo/route");
    const response = await POST(
      new Request("http://localhost/api/socios/9/consumo", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ items: [{ productoId: 3, cantidad: 3 }, { productoId: 4, cantidad: 2 }] }),
      }),
      { params: Promise.resolve({ id: "9" }) }
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      id: 9,
      nombre: "Ada",
      numeroSocio: "S-009",
      credito: 20.1,
      creditoNoRetornable: 0,
      estadoPulsera: "activa",
      meta: {
        idempotency: { key: null, replayed: false },
        operator: "scanner",
        puntoVentaId: null,
        transactionId: 1,
        transactionType: "consumo",
      },
    });
  });

  it("charges the guest balance once and replays the stored response on retry", async () => {
    authMocks.getSession.mockResolvedValue({
      actorType: "scanner",
      actorId: "scanner",
      sessionVersion: 1,
    });

    const { POST } = await import("@/app/api/socios/[id]/consumo/route");

    const request = () => POST(
      new Request("http://localhost/api/socios/-1/consumo", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-idempotency-key": "guest-charge-1",
        },
        body: JSON.stringify({ items: [{ productoId: 3, cantidad: 1 }, { productoId: 4, cantidad: 2 }] }),
      }),
      { params: Promise.resolve({ id: "-1" }) }
    );

    const firstResponse = await request();
    const replayResponse = await request();

    expect(firstResponse.status).toBe(200);
    expect(replayResponse.status).toBe(200);
    await expect(replayResponse.json()).resolves.toEqual({
      id: -1,
      nombre: "Invitado",
      numeroSocio: "I-001",
      credito: 5,
      estadoPulsera: "activa",
      meta: {
        idempotency: { key: "guest-charge-1", replayed: true },
        operator: "scanner",
        puntoVentaId: null,
        transactionId: null,
        transactionType: "consumo",
      },
    });
    expect(dbMock.__state.guestSession.balance).toBe(5);
    expect(dbMock.transaccion.create).not.toHaveBeenCalled();
  });

  it("rejects refunds above the returnable balance with normalized money details", async () => {
    authMocks.getSession.mockResolvedValue({
      actorType: "admin",
      actorId: "admin",
      sessionVersion: 1,
    });

    const { POST } = await import("@/app/api/socios/[id]/devolver/route");
    const response = await POST(
      new Request("http://localhost/api/socios/9/devolver", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ cantidad: 26 }),
      }),
      { params: Promise.resolve({ id: "9" }) }
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "La cantidad a devolver supera el saldo retornable",
      details: {
        retornable: 25,
        credito: 30,
        creditoNoRetornable: 5,
      },
    });
    expect(dbMock.transaccion.create).not.toHaveBeenCalled();
  });
});
