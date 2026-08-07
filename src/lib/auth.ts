import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import bcrypt from "bcryptjs";
import { createHash, timingSafeEqual } from "crypto";
import { db } from "./db";
import { canAccessScanner, getActorContext } from "./access";

export interface SessionData {
  isLoggedIn: boolean;
  scannerVerified: boolean;
  actorType?: "admin" | "scanner" | "punto";
  actorId?: string;
  adminUserId?: number;
  adminUsername?: string;
  adminNombre?: string;
  puntoVentaId?: number;
  puntoNombre?: string;
  puntoPermiso?: PermisoPunto;
  sessionVersion?: number;
}

export type PermisoPunto = "barra" | "caja";

function getSessionOptions(secureCookie = process.env.NODE_ENV === "production") {
  return {
    cookieName: "comparsa_admin_session",
    password: process.env.SESSION_SECRET || "complex_password_at_least_32_characters_long_for_security",
    ttl: 60 * 60 * 8,
    cookieOptions: {
      secure: secureCookie,
      httpOnly: true,
      sameSite: "lax" as const,
    },
  };
}

function secureCompare(value: string, expected: string): boolean {
  const valueHash = createHash("sha256").update(value).digest();
  const expectedHash = createHash("sha256").update(expected).digest();
  return timingSafeEqual(valueHash, expectedHash);
}

export async function verifyPassword(password: string, expected: string): Promise<boolean> {
  if (expected.startsWith("$2a$") || expected.startsWith("$2b$") || expected.startsWith("$2y$")) {
    return bcrypt.compare(password, expected);
  }

  return secureCompare(password, expected);
}

export async function getSession() {
  const cookieStore = await cookies();
  const session = await getIronSession<SessionData>(cookieStore, getSessionOptions());

  if (!session.isLoggedIn) session.isLoggedIn = false;
  if (!session.scannerVerified) session.scannerVerified = false;
  if (!session.sessionVersion) session.sessionVersion = 1;

  const actor = getActorContext(session);
  if (actor.actorType !== "anonymous") {
    session.actorType = actor.actorType;
    session.actorId = actor.actorId ?? undefined;
  }

  return session;
}

async function saveAdminSession(input: {
  secureCookie?: boolean;
  adminUserId: number;
  adminUsername: string;
  adminNombre: string;
}) {
  const cookieStore = await cookies();
  const session = await getIronSession<SessionData>(cookieStore, getSessionOptions(input.secureCookie));
  session.isLoggedIn = true;
  session.scannerVerified = false;
  session.actorType = "admin";
  session.actorId = `admin:${input.adminUserId}`;
  session.adminUserId = input.adminUserId;
  session.adminUsername = input.adminUsername;
  session.adminNombre = input.adminNombre;
  session.puntoVentaId = undefined;
  session.puntoNombre = undefined;
  session.puntoPermiso = undefined;
  session.sessionVersion = 1;
  await session.save();
}

export async function loginAdminUser(input: {
  username: string;
  password: string;
  secureCookie?: boolean;
}): Promise<string | null> {
  const { authenticateAdminUser } = await import("@/lib/admin-users");
  const adminUser = await authenticateAdminUser(input.username, input.password);
  if (!adminUser) {
    return null;
  }

  await saveAdminSession({
    secureCookie: input.secureCookie,
    adminUserId: adminUser.id,
    adminUsername: adminUser.username,
    adminNombre: adminUser.nombre,
  });

  return "admin";
}

export async function bootstrapAdminUser(input: {
  nombre: string;
  username: string;
  password: string;
  masterPassword: string;
  secureCookie?: boolean;
}): Promise<string | null> {
  const { createAdminUser, hasAdminUsers } = await import("@/lib/admin-users");
  if (await hasAdminUsers()) {
    return null;
  }

  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword || !(await verifyPassword(input.masterPassword, adminPassword))) {
    return null;
  }

  const adminUser = await createAdminUser({
    nombre: input.nombre,
    username: input.username,
    password: input.password,
  });

  await saveAdminSession({
    secureCookie: input.secureCookie,
    adminUserId: adminUser.id,
    adminUsername: adminUser.username,
    adminNombre: adminUser.nombre,
  });

  return "admin";
}

export async function loginScannerOrPunto(password: string, secureCookie?: boolean): Promise<string | null> {
  const punto = await loginPuntoVenta(password, secureCookie);
  if (punto) return punto;

  const scannerPassword = process.env.SCANNER_PASSWORD;
  if (scannerPassword && await verifyPassword(password, scannerPassword)) {
    const cookieStore = await cookies();
    const session = await getIronSession<SessionData>(cookieStore, getSessionOptions(secureCookie));
    session.isLoggedIn = false;
    session.scannerVerified = true;
      session.actorType = "scanner";
      session.actorId = "scanner";
      session.adminUserId = undefined;
      session.adminUsername = undefined;
      session.adminNombre = undefined;
      session.puntoVentaId = undefined;
      session.puntoNombre = undefined;
      session.puntoPermiso = undefined;
    session.sessionVersion = 1;
    await session.save();
    return "scanner";
  }

  return null;
}

async function loginPuntoVenta(password: string, secureCookie?: boolean): Promise<string | null> {
  const puntos = await db.puntoVenta.findMany({ where: { activo: true } });
  for (const punto of puntos) {
    if (await verifyPassword(password, punto.password)) {
      const cookieStore = await cookies();
      const session = await getIronSession<SessionData>(cookieStore, getSessionOptions(secureCookie));
      session.isLoggedIn = false;
      session.scannerVerified = true;
      session.actorType = "punto";
      session.actorId = `punto:${punto.id}`;
      session.adminUserId = undefined;
      session.adminUsername = undefined;
      session.adminNombre = undefined;
      session.puntoVentaId = punto.id;
      session.puntoNombre = punto.nombre;
      session.puntoPermiso = punto.permiso;
      session.sessionVersion = 1;
      await session.save();
      return punto.permiso;
    }
  }
  return null;
}

export async function logout(secureCookie?: boolean) {
  const cookieStore = await cookies();
  const session = await getIronSession<SessionData>(cookieStore, getSessionOptions(secureCookie));
  session.destroy();
}

export async function hasScannerAccess(): Promise<boolean> {
  const session = await getSession();
  return canAccessScanner(session);
}

export async function getOperador(): Promise<string | null> {
  const session = await getSession();
  const actor = getActorContext(session);
  if (actor.actorType === "admin") return session.adminNombre ?? session.adminUsername ?? "admin";
  if (actor.actorType === "punto") return session.puntoNombre ?? "punto";
  if (actor.actorType === "scanner") return "scanner";
  return null;
}

export async function getPuntoPermiso(): Promise<PermisoPunto | "admin" | null> {
  const session = await getSession();
  const actor = getActorContext(session);
  if (actor.actorType === "admin") return "admin";
  if (session.puntoPermiso === "barra" || session.puntoPermiso === "caja") return session.puntoPermiso;
  return null;
}

export async function getPuntoVentaId(): Promise<number | null> {
  const session = await getSession();
  return session.puntoVentaId ?? null;
}
