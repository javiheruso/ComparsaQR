import type { NextRequest } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

function isAuthorizedCronRequest(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return true;

  return request.headers.get("authorization") === `Bearer ${cronSecret}`;
}

export async function GET(request: NextRequest) {
  if (!isAuthorizedCronRequest(request)) {
    return Response.json({ status: "unauthorized" }, { status: 401 });
  }

  try {
    await db.heartbeat.upsert({
      where: { key: "singleton" },
      update: { timestamp: new Date() },
      create: { key: "singleton" },
    });

    return Response.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      source: request.headers.get("x-vercel-cron-schedule") ? "vercel-cron" : "manual",
      schedule: request.headers.get("x-vercel-cron-schedule"),
    });
  } catch (error) {
    return Response.json(
      { status: "error", message: String(error) },
      { status: 500 }
    );
  }
}
