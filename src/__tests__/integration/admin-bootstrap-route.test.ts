import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  bootstrapAdminUser: vi.fn(),
}));

const adminUserMocks = vi.hoisted(() => ({
  hasAdminUsers: vi.fn(),
}));

vi.mock("@/lib/auth", () => authMocks);
vi.mock("@/lib/admin-users", () => adminUserMocks);

describe("bootstrap admin route", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("creates the first admin when no admin users exist", async () => {
    adminUserMocks.hasAdminUsers.mockResolvedValue(false);
    authMocks.bootstrapAdminUser.mockResolvedValue("admin");

    const { POST } = await import("@/app/api/auth/bootstrap-admin/route");
    const response = await POST(new Request("http://localhost/api/auth/bootstrap-admin", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        masterPassword: "master",
        nombre: "Ada Lovelace",
        username: "ada",
        password: "secret123",
      }),
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ success: true, tipo: "admin" });
  });

  it("rejects bootstrap after admins already exist", async () => {
    adminUserMocks.hasAdminUsers.mockResolvedValue(true);

    const { POST } = await import("@/app/api/auth/bootstrap-admin/route");
    const response = await POST(new Request("http://localhost/api/auth/bootstrap-admin", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        masterPassword: "master",
        nombre: "Ada Lovelace",
        username: "ada",
        password: "secret123",
      }),
    }));

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({ error: "La inicialización ya se ha completado" });
  });
});
