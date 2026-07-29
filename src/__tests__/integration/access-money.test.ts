import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { requireAccess } from "@/lib/access";

const authMocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  getOperador: vi.fn(),
  getPuntoVentaId: vi.fn(),
}));

const dbMock = vi.hoisted(() => ({
  socio: {
    findUnique: vi.fn(),
  },
  producto: {
    findMany: vi.fn(),
  },
  $transaction: vi.fn(),
}));

vi.mock("@/lib/auth", () => authMocks);
vi.mock("@/lib/db", () => ({ db: dbMock }));

describe("requireAccess", () => {
  it("allows caja sessions to load member credit", () => {
    const decision = requireAccess(
      { actorType: "punto", actorId: "punto:7", puntoPermiso: "caja", sessionVersion: 1 },
      {
        allowRoles: ["admin", "punto"],
        allowedPuntoPermissions: ["caja"],
        unauthenticatedMessage: "No autorizado",
        forbiddenMessage: "Este punto no tiene permiso para recargar",
      }
    );

    expect(decision).toEqual({ ok: true });
  });

  it("rejects scanner sessions from admin-only money operations", () => {
    const decision = requireAccess(
      { actorType: "scanner", actorId: "scanner", sessionVersion: 1 },
      {
        allowRoles: ["admin", "punto"],
        allowedPuntoPermissions: ["caja"],
        unauthenticatedMessage: "No autorizado",
        forbiddenMessage: "Este punto no tiene permiso para recargar",
      }
    );

    expect(decision).toEqual({
      ok: false,
      status: 403,
      message: "Este punto no tiene permiso para recargar",
    });
  });
});

describe("money route boundaries", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    authMocks.getOperador.mockResolvedValue("Caja Norte");
    authMocks.getPuntoVentaId.mockResolvedValue(7);
  });

  it("does not mutate credit when a scanner session hits the credit endpoint", async () => {
    authMocks.getSession.mockResolvedValue({
      actorType: "scanner",
      actorId: "scanner",
      sessionVersion: 1,
    });

    const { POST } = await import("@/app/api/socios/[id]/credito/route");
    const response = await POST(
      new Request("http://localhost/api/socios/9/credito", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ cantidad: 10, descripcion: "Carga" }),
      }),
      { params: Promise.resolve({ id: "9" }) }
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: "Este punto no tiene permiso para recargar",
    });
    expect(dbMock.socio.findUnique).not.toHaveBeenCalled();
    expect(dbMock.$transaction).not.toHaveBeenCalled();
  });

  it("allows caja sessions to load member credit", async () => {
    authMocks.getSession.mockResolvedValue({
      actorType: "punto",
      actorId: "punto:7",
      puntoPermiso: "caja",
      sessionVersion: 1,
    });

    dbMock.socio.findUnique.mockResolvedValue({ id: 9, estadoPulsera: "activa" });

    const tx = {
      socio: {
        findUnique: vi.fn().mockResolvedValue({ id: 9, estadoPulsera: "activa", credito: 30, creditoNoRetornable: 0, nombre: "Ada", numeroSocio: "S-009" }),
        update: vi.fn().mockResolvedValue({ id: 9, nombre: "Ada", numeroSocio: "S-009", estadoPulsera: "activa", credito: 45, creditoNoRetornable: 0 }),
      },
      transaccion: {
        create: vi.fn().mockResolvedValue({ id: 1 }),
      },
      idempotencyRecord: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({ scope: "member-credit:9", key: "k", requestHash: "h", status: "pending", responseCode: null, responseBody: null, createdAt: new Date(), updatedAt: new Date() }),
        update: vi.fn().mockResolvedValue({ scope: "member-credit:9", key: "k", requestHash: "h", status: "completed", responseCode: 200, responseBody: { id: 9, credito: 45 }, createdAt: new Date(), updatedAt: new Date() }),
      },
    };

    dbMock.$transaction.mockImplementation(async (callback: (transaction: typeof tx) => Promise<unknown>) => callback(tx as typeof tx));

    const { POST } = await import("@/app/api/socios/[id]/credito/route");
    const response = await POST(
      new Request("http://localhost/api/socios/9/credito", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ cantidad: 15, descripcion: "Carga" }),
      }),
      { params: Promise.resolve({ id: "9" }) }
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ id: 9, credito: 45 });
    expect(tx.socio.update).toHaveBeenCalledOnce();
    expect(tx.transaccion.create).toHaveBeenCalledOnce();
  });

  it("keeps scanner sessions working for consumo flows", async () => {
    authMocks.getSession.mockResolvedValue({
      actorType: "scanner",
      actorId: "scanner",
      sessionVersion: 1,
    });

    dbMock.producto.findMany.mockResolvedValue([
      { id: 3, nombre: "Agua", precio: 2.5 },
    ]);
    dbMock.socio.findUnique.mockResolvedValueOnce({
      id: 9,
      estadoPulsera: "activa",
      credito: 20,
    });

    const tx = {
      producto: {
        findMany: vi.fn().mockResolvedValue([{ id: 3, nombre: "Agua", precio: 2.5 }]),
      },
      socio: {
        findUnique: vi
          .fn()
          .mockResolvedValueOnce({ id: 9, estadoPulsera: "activa", credito: 20, creditoNoRetornable: 0, nombre: "Ada", numeroSocio: "S-009" })
          .mockResolvedValueOnce({ creditoNoRetornable: 0 })
          .mockResolvedValueOnce({ id: 9, credito: 17.5, creditoNoRetornable: 0, estadoPulsera: "activa", nombre: "Ada", numeroSocio: "S-009" }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      transaccion: {
        create: vi.fn().mockResolvedValue({ id: 3 }),
      },
      idempotencyRecord: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({ scope: "member-charge:9", key: "k", requestHash: "h", status: "pending", responseCode: null, responseBody: null, createdAt: new Date(), updatedAt: new Date() }),
        update: vi.fn().mockResolvedValue({ scope: "member-charge:9", key: "k", requestHash: "h", status: "completed", responseCode: 200, responseBody: { id: 9, credito: 17.5 }, createdAt: new Date(), updatedAt: new Date() }),
      },
    };

    dbMock.$transaction.mockImplementation(async (callback: (transaction: typeof tx) => Promise<unknown>) => callback(tx as typeof tx));

    const { POST } = await import("@/app/api/socios/[id]/consumo/route");
    const response = await POST(
      new Request("http://localhost/api/socios/9/consumo", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ items: [{ productoId: 3, cantidad: 1 }] }),
      }),
      { params: Promise.resolve({ id: "9" }) }
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ id: 9, credito: 17.5 });
    expect(tx.socio.updateMany).toHaveBeenCalledOnce();
    expect(tx.transaccion.create).toHaveBeenCalledOnce();
  });
});

describe("proxy access policy", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("redirects scanner sessions away from admin pages", async () => {
    authMocks.getSession.mockResolvedValue({
      actorType: "scanner",
      actorId: "scanner",
      sessionVersion: 1,
    });

    const { default: proxy } = await import("@/proxy");
    const response = await proxy(new NextRequest("http://localhost/admin"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost/");
  });

  it("keeps login endpoints public", async () => {
    const { default: proxy } = await import("@/proxy");
    const response = await proxy(new NextRequest("http://localhost/api/auth/login"));

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });
});
