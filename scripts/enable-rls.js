import { PrismaClient } from "../src/generated/prisma/index.js";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

async function main() {
  const prisma = new PrismaClient();

  try {
    const sql = readFileSync(join(__dirname, "enable-rls.sql"), "utf-8");

    const statements = sql
      .split(";")
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && !s.startsWith("--"));

    for (const stmt of statements) {
      console.log(`Ejecutando: ${stmt.substring(0, 80)}...`);
      await prisma.$executeRawUnsafe(stmt + ";");
    }

    console.log("\n✓ RLS habilitado en todas las tablas.");
  } catch (err) {
    console.error("Error:", err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
