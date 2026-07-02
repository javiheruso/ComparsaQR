require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });
const bcrypt = require("bcryptjs");
const { Pool } = require("pg");

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  const hash1 = await bcrypt.hash("barra123", 10);
  const hash2 = await bcrypt.hash("caja123", 10);

  await pool.query(`
    INSERT INTO "PuntoVenta" (nombre, password, permiso, activo, "createdAt", "updatedAt")
    VALUES ($1, $2, 'barra', true, NOW(), NOW())
    ON CONFLICT (nombre) DO UPDATE SET password = $2, activo = true
  `, ["Barra Principal", hash1]);

  await pool.query(`
    INSERT INTO "PuntoVenta" (nombre, password, permiso, activo, "createdAt", "updatedAt")
    VALUES ($1, $2, 'caja', true, NOW(), NOW())
    ON CONFLICT (nombre) DO UPDATE SET password = $2, activo = true
  `, ["Caja Recarga", hash2]);

  console.log("Puntos creados: Barra Principal (barra/barra123), Caja Recarga (caja/caja123)");
  await pool.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
