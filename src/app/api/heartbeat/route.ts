import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await db.heartbeat.upsert({
      where: { key: "singleton" },
      update: { timestamp: new Date() },
      create: { key: "singleton" },
    });
    return Response.json({
      status: "ok",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return Response.json(
      { status: "error", message: String(error) },
      { status: 500 }
    );
  }
}
