import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  getOperador: vi.fn(),
}));

const dbMock = vi.hoisted(() => ({
  socio: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  qrTokenAudit: {
    create: vi.fn(),
  },
  $transaction: vi.fn(),
}));

vi.mock("@/lib/auth", () => authMocks);
vi.mock("@/lib/db", () => ({ db: dbMock }));

describe("qr reconcile route", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    authMocks.getSession.mockResolvedValue({ isLoggedIn: true, actorType: "admin", actorId: "admin" });
    authMocks.getOperador.mockResolvedValue("admin");
  });

  it("reconciles a scanned token to the chosen member and records audit", async () => {
    const targetSocio = { id: 7, nombre: "ADA", numeroSocio: "s-007", qrToken: "old-token" };
    const updatedSocio = { ...targetSocio, qrToken: "printed-token" };

    dbMock.socio.findUnique
      .mockResolvedValueOnce(targetSocio)
      .mockResolvedValueOnce(null);
    dbMock.$transaction.mockImplementation(async (callback: (tx: typeof dbMock) => Promise<unknown>) => {
      dbMock.socio.update.mockResolvedValue(updatedSocio);
      return callback(dbMock as typeof dbMock);
    });

    const { POST } = await import("@/app/api/socios/reconciliar-qr/route");
    const response = await POST(new Request("http://localhost/api/socios/reconciliar-qr", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ socioId: 7, currentToken: "printed-token" }),
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ id: 7, qrToken: "printed-token" });
    expect(dbMock.qrTokenAudit.create).toHaveBeenCalledWith({
      data: {
        socioId: 7,
        action: "reconciled",
        oldQrToken: "old-token",
        newQrToken: "printed-token",
        actor: "admin",
      },
    });
  });

  it("rejects reconciliation when the scanned token already belongs to another member", async () => {
    dbMock.socio.findUnique
      .mockResolvedValueOnce({ id: 7, nombre: "ADA", numeroSocio: "s-007", qrToken: "old-token" })
      .mockResolvedValueOnce({ id: 3, nombre: "GRACE", numeroSocio: "s-003", qrToken: "printed-token" });

    const { POST } = await import("@/app/api/socios/reconciliar-qr/route");
    const response = await POST(new Request("http://localhost/api/socios/reconciliar-qr", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ socioId: 7, currentToken: "printed-token" }),
    }));

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: "Ese QR ya pertenece a GRACE (#s-003)",
    });
    expect(dbMock.qrTokenAudit.create).not.toHaveBeenCalled();
  });
});
