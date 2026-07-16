import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import bcrypt from "bcryptjs";
import { createHash, timingSafeEqual } from "crypto";
import { db } from "./db";

export interface SessionData {
  isLoggedIn: boolean;
  scannerVerified: boolean;
  puntoVentaId?: number;
  puntoNombre?: string;
  puntoPermiso?: PermisoPunto;
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

  return session;
}

export async function login(password: string, secureCookie?: boolean): Promise<string | null> {
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (adminPassword && await verifyPassword(password, adminPassword)) {
    const cookieStore = await cookies();
    const session = await getIronSession<SessionData>(cookieStore, getSessionOptions(secureCookie));
    session.isLoggedIn = true;
    session.scannerVerified = false;
    session.puntoVentaId = undefined;
    session.puntoNombre = undefined;
    session.puntoPermiso = undefined;
    await session.save();
    return "admin";
  }

  const punto = await loginPuntoVenta(password, secureCookie);
  if (punto) return punto;

  const scannerPassword = process.env.SCANNER_PASSWORD;
  if (scannerPassword && await verifyPassword(password, scannerPassword)) {
    const cookieStore = await cookies();
    const session = await getIronSession<SessionData>(cookieStore, getSessionOptions(secureCookie));
    session.isLoggedIn = false;
    session.scannerVerified = true;
    session.puntoVentaId = undefined;
    session.puntoNombre = undefined;
    session.puntoPermiso = undefined;
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
      session.puntoVentaId = punto.id;
      session.puntoNombre = punto.nombre;
      session.puntoPermiso = punto.permiso;
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
  return Boolean(session.isLoggedIn || session.scannerVerified);
}

export async function getOperador(): Promise<string | null> {
  const session = await getSession();
  if (session.isLoggedIn) return "admin";
  if (session.puntoNombre) return session.puntoNombre;
  if (session.scannerVerified) return "scanner";
  return null;
}

export async function getPuntoPermiso(): Promise<PermisoPunto | "admin" | null> {
  const session = await getSession();
  if (session.isLoggedIn) return "admin";
  if (session.puntoPermiso === "barra" || session.puntoPermiso === "caja") return session.puntoPermiso;
  return null;
}

export async function getPuntoVentaId(): Promise<number | null> {
  const session = await getSession();
  return session.puntoVentaId ?? null;
}
