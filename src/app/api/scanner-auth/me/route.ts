import { hasScannerAccess } from "@/lib/auth";

export async function GET() {
  const verified = await hasScannerAccess();

  if (!verified) {
    return Response.json({ verified: false }, { status: 401 });
  }

  return Response.json({ verified: true });
}
