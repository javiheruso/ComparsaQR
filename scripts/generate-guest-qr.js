/**
 * Genera el QR de invitado como imagen PNG.
 * Uso:
 *   node scripts/generate-guest-qr.js                              (usa NEXT_PUBLIC_APP_URL del .env)
 *   node scripts/generate-guest-qr.js --domain https://tudominio.com
 *
 * Lee GUEST_QR_TOKEN del .env y genera un PNG en temp/guest-qr.png
 */
require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });
const fs = require("fs");
const path = require("path");
const QRCode = require("qrcode");

async function main() {
  const token = process.env.GUEST_QR_TOKEN;
  if (!token) {
    console.error("ERROR: GUEST_QR_TOKEN no está definido en .env");
    process.exit(1);
  }

  const domainIndex = process.argv.indexOf("--domain");
  const domain = domainIndex !== -1 ? process.argv[domainIndex + 1] : null;
  const appUrl = domain || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const url = `${appUrl}/scanner/result?token=${token}`;

  const outDir = path.resolve(__dirname, "../temp");
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const outPath = path.join(outDir, "guest-qr.png");
  await QRCode.toFile(outPath, url, {
    width: 500,
    margin: 2,
    color: { dark: "#000000", light: "#FFFFFF" },
  });

  console.log(`QR de invitado generado: ${outPath}`);
  console.log(`URL codificada: ${url}`);
}

main().catch(console.error);
