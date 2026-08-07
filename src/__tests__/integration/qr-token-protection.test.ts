import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  QR_DELETE_CONFIRMATION_TEXT,
  QR_REGEN_CONFIRMATION_TEXT,
} from "@/lib/qr-token-protection";

const authMocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  getOperador: vi.fn(),
}));

const dbMock = vi.hoisted(() => ({
  socio: {
    findUnique: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  qrTokenAudit: {
    create: vi.fn(),
  },
  $transaction: vi.fn(),
}));

vi.mock("@/lib/auth", () => authMocks);
vi.mock("@/lib/db", () => ({ db: dbMock }));

describe("QR token protections", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    authMocks.getSession.mockResolvedValue({ isLoggedIn: true, actorType: "admin", actorId: "admin" });
    authMocks.getOperador.mockResolvedValue("admin");
  });

  it("rejects QR regeneration without typed confirmation", async () => {
    const { PATCH } = await import("@/app/api/socios/[id]/regenerar-qr/route");

    const response = await PATCH(
      new Request("http://localhost/api/socios/9/regenerar-qr", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ confirmationText: "no", currentToken: "qr-1" }),
      }),
      { params: Promise.resolve({ id: "9" }) }
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: `Escribe exactamente \"${QR_REGEN_CONFIRMATION_TEXT}\" para continuar`,
    });
    expect(dbMock.socio.findUnique).not.toHaveBeenCalled();
  });

  it("audits QR regeneration before returning the updated member", async () => {
    const socio = { id: 9, qrToken: "qr-1", estadoPulsera: "activa" };
    const updated = { ...socio, qrToken: "qr-2", estadoPulsera: "perdida" };

    dbMock.socio.findUnique.mockResolvedValue(socio);
    dbMock.$transaction.mockImplementation(async (callback: (tx: typeof dbMock) => Promise<unknown>) => {
      dbMock.socio.update.mockResolvedValue(updated);
      return callback(dbMock as typeof dbMock);
    });

    const { PATCH } = await import("@/app/api/socios/[id]/regenerar-qr/route");
    const response = await PATCH(
      new Request("http://localhost/api/socios/9/regenerar-qr", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ confirmationText: QR_REGEN_CONFIRMATION_TEXT, currentToken: "qr-1" }),
      }),
      { params: Promise.resolve({ id: "9" }) }
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ id: 9, estadoPulsera: "perdida" });
    expect(dbMock.socio.update).toHaveBeenCalledOnce();
    expect(dbMock.qrTokenAudit.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        socioId: 9,
        action: "regenerated",
        oldQrToken: "qr-1",
        actor: "admin",
      }),
    });
  });

  it("rejects member deletion without typed confirmation", async () => {
    const { DELETE } = await import("@/app/api/socios/[id]/route");

    const response = await DELETE(
      new Request("http://localhost/api/socios/9", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ confirmationText: "borrar", currentToken: "qr-1" }),
      }),
      { params: Promise.resolve({ id: "9" }) }
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: `Escribe exactamente \"${QR_DELETE_CONFIRMATION_TEXT}\" para continuar`,
    });
    expect(dbMock.socio.findUnique).not.toHaveBeenCalled();
  });

  it("audits the current QR token before deleting a member", async () => {
    const socio = { id: 9, qrToken: "qr-1" };
    dbMock.socio.findUnique.mockResolvedValue(socio);
    dbMock.$transaction.mockImplementation(async (callback: (tx: typeof dbMock) => Promise<unknown>) => callback(dbMock as typeof dbMock));

    const { DELETE } = await import("@/app/api/socios/[id]/route");
    const response = await DELETE(
      new Request("http://localhost/api/socios/9", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ confirmationText: QR_DELETE_CONFIRMATION_TEXT, currentToken: "qr-1" }),
      }),
      { params: Promise.resolve({ id: "9" }) }
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ success: true });
    expect(dbMock.qrTokenAudit.create).toHaveBeenCalledWith({
      data: {
        socioId: 9,
        action: "deleted",
        oldQrToken: "qr-1",
        newQrToken: null,
        actor: "admin",
      },
    });
    expect(dbMock.socio.delete).toHaveBeenCalledWith({ where: { id: 9 } });
  });
});
