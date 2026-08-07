import bcrypt from "bcryptjs";

import { db } from "@/lib/db";
import { verifyPassword } from "@/lib/auth";

export async function hasAdminUsers() {
  return (await db.adminUser.count()) > 0;
}

export async function createAdminUser(input: {
  username: string;
  nombre: string;
  password: string;
}) {
  return db.adminUser.create({
    data: {
      username: normalizeUsername(input.username),
      nombre: input.nombre.trim(),
      passwordHash: await bcrypt.hash(input.password, 10),
    },
  });
}

export async function authenticateAdminUser(username: string, password: string) {
  const adminUser = await db.adminUser.findUnique({
    where: { username: normalizeUsername(username) },
  });

  if (!adminUser || !adminUser.activo) {
    return null;
  }

  const valid = await verifyPassword(password, adminUser.passwordHash);
  return valid ? adminUser : null;
}

export function normalizeUsername(value: string) {
  return value.trim().toLowerCase();
}
