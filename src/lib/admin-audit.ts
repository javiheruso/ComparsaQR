import { db } from "@/lib/db";
import type { SessionData } from "@/lib/auth";

function toJsonValue(value: Record<string, unknown> | null | undefined) {
  if (!value) return undefined;
  return JSON.parse(JSON.stringify(value));
}

export async function logAdminAction(input: {
  session: Partial<SessionData> | null | undefined;
  action: string;
  targetType: string;
  targetId?: string | null;
  summary?: string | null;
  details?: Record<string, unknown> | null;
}) {
  const { session, action, targetType, targetId, summary, details } = input;

  if (!session || session.actorType !== "admin") {
    return;
  }

  await db.adminActionLog.create({
    data: {
      adminUserId: session.adminUserId ?? null,
      action,
      targetType,
      targetId: targetId ?? null,
      summary: summary ?? null,
      details: toJsonValue(details),
    },
  });
}
