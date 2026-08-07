import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  getSession: vi.fn(),
}));

const adminUserLibMocks = vi.hoisted(() => ({
  createAdminUser: vi.fn(),
  normalizeUsername: vi.fn((value: string) => value.trim().toLowerCase()),
}));

const auditMocks = vi.hoisted(() => ({
  logAdminAction: vi.fn(),
}));

const dbMock = vi.hoisted(() => ({
  adminUser: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock("@/lib/auth", () => authMocks);
vi.mock("@/lib/admin-users", () => adminUserLibMocks);
vi.mock("@/lib/admin-audit", () => auditMocks);
vi.mock("@/lib/db", () => ({ db: dbMock }));

describe("admin users routes", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    authMocks.getSession.mockResolvedValue({ isLoggedIn: true, actorType: "admin", actorId: "admin:1", adminUserId: 1 });
  });

  it("lists admin users for authenticated admins", async () => {
    dbMock.adminUser.findMany.mockResolvedValue([{ id: 1, username: "ada", nombre: "Ada", activo: true, createdAt: new Date(), updatedAt: new Date() }]);

    const { GET } = await import("@/app/api/admin-users/route");
    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toHaveLength(1);
  });

  it("creates admin users and writes an audit log", async () => {
    dbMock.adminUser.findUnique.mockResolvedValue(null);
    adminUserLibMocks.createAdminUser.mockResolvedValue({
      id: 2,
      username: "grace",
      nombre: "Grace Hopper",
      activo: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const { POST } = await import("@/app/api/admin-users/route");
    const response = await POST(new Request("http://localhost/api/admin-users", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ nombre: "Grace Hopper", username: "grace", password: "secret123" }),
    }));

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({ username: "grace", nombre: "Grace Hopper" });
    expect(auditMocks.logAdminAction).toHaveBeenCalledOnce();
  });
});
