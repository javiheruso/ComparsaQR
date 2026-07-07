import { db } from "./db";

const GUEST_ID = -1;
const SALDO_INICIAL = 100;
const RESET_MINUTOS = 5;

export function getGuestToken(): string | null {
  return process.env.GUEST_QR_TOKEN || null;
}

export function isGuestToken(token: string): boolean {
  const guestToken = getGuestToken();
  return !!guestToken && token === guestToken;
}

export function isGuestId(id: number): boolean {
  return id === GUEST_ID;
}

export async function getGuestProfile() {
  let session = await db.guestSession.findUnique({ where: { id: 1 } });
  if (!session) {
    session = await db.guestSession.create({
      data: { id: 1, balance: SALDO_INICIAL, lastChargeAt: null },
    });
  }

  if (session.balance <= 0 && session.lastChargeAt) {
    const elapsed = (Date.now() - session.lastChargeAt.getTime()) / 1000 / 60;
    if (elapsed >= RESET_MINUTOS) {
      session = await db.guestSession.update({
        where: { id: 1 },
        data: { balance: SALDO_INICIAL, lastChargeAt: null },
      });
    }
  }

  return {
    id: GUEST_ID,
    nombre: "Invitado",
    numeroSocio: "I-001",
    credito: session.balance,
    estadoPulsera: "activa" as const,
  };
}

export async function chargeGuest(total: number): Promise<boolean> {
  const session = await db.guestSession.findUnique({ where: { id: 1 } });
  if (!session || session.balance < total) return false;

  await db.guestSession.update({
    where: { id: 1 },
    data: {
      balance: { decrement: total },
      lastChargeAt: new Date(),
    },
  });
  return true;
}

export const GUEST_ID_CONST = GUEST_ID;