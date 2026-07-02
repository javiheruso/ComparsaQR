import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import bcrypt from "bcryptjs";
import { createHash, timingSafeEqual } from "crypto";

export interface SessionData {
  isLoggedIn: boolean;
  scannerVerified: boolean;
}

function getSessionOptions(secureCookie = process.env.NODE_ENV === "production") {
  return {
    cookieName: "comparsa_admin_session",
    password: process.env.SESSION_SECRET || "complex_password_at_least_32_characters_long_for_security",
    ttl: 60 * 60 * 8, // 8 hours
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

  if (!session.isLoggedIn) {
    session.isLoggedIn = false;
  }
  if (!session.scannerVerified) {
    session.scannerVerified = false;
  }

  return session;
}

export async function login(password: string, secureCookie?: boolean): Promise<boolean> {
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) return false;

  const isValid = await verifyPassword(password, adminPassword);

  if (isValid) {
    const cookieStore = await cookies();
    const session = await getIronSession<SessionData>(cookieStore, getSessionOptions(secureCookie));
    session.isLoggedIn = true;
    await session.save();
  }

  return isValid;
}

export async function logout(secureCookie?: boolean) {
  const cookieStore = await cookies();
  const session = await getIronSession<SessionData>(cookieStore, getSessionOptions(secureCookie));
  session.destroy();
}

export async function verifyScannerDevice(password: string, secureCookie?: boolean): Promise<boolean> {
  const scannerPassword = process.env.SCANNER_PASSWORD;
  if (!scannerPassword) return false;

  const isValid = await verifyPassword(password, scannerPassword);

  if (isValid) {
    const cookieStore = await cookies();
    const session = await getIronSession<SessionData>(cookieStore, getSessionOptions(secureCookie));
    session.scannerVerified = true;
    await session.save();
  }

  return isValid;
}

export async function hasScannerAccess(): Promise<boolean> {
  const session = await getSession();
  return Boolean(session.isLoggedIn || session.scannerVerified);
}

export async function getOperador(): Promise<string | null> {
  const session = await getSession();
  if (session.isLoggedIn) return "admin";
  if (session.scannerVerified) return "scanner";
  return null;
}
