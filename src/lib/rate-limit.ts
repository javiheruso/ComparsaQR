import { db } from "./db";

export async function checkRateLimit(
  key: string,
  maxAttempts = 10,
  windowMs = 60_000
): Promise<{ allowed: boolean; remaining: number }> {
  const now = new Date();

  const record = await db.rateLimit.findUnique({ where: { key } });

  if (!record || now > record.resetAt) {
    await db.rateLimit.upsert({
      where: { key },
      create: { key, count: 1, resetAt: new Date(now.getTime() + windowMs) },
      update: { count: 1, resetAt: new Date(now.getTime() + windowMs) },
    });
    return { allowed: true, remaining: maxAttempts - 1 };
  }

  const updated = await db.rateLimit.update({
    where: { key },
    data: { count: { increment: 1 } },
  });

  const allowed = updated.count <= maxAttempts;
  return {
    allowed,
    remaining: allowed ? maxAttempts - updated.count : 0,
  };
}
