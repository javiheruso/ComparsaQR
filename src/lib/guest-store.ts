import { Decimal } from "@prisma/client/runtime/client";
import type { PrismaClient } from "@/generated/prisma/client";

import { db } from "./db";
import { moneyToNumber, parseMoney } from "./money";

const GUEST_ID = -1;
const SALDO_INICIAL = parseMoney("100.00");
const RESET_MINUTOS = 5;

type GuestSessionRecord = {
  id: number;
  balance: Decimal | number | string;
  lastChargeAt: Date | null;
};

export type GuestStoreClient = Pick<PrismaClient, "guestSession">;

export type GuestProfile = {
  id: number;
  nombre: string;
  numeroSocio: string;
  credito: number;
  estadoPulsera: "activa";
};

function getGuestClient(client?: GuestStoreClient) {
  return client ?? db;
}

function toGuestProfile(session: GuestSessionRecord): GuestProfile {
  return {
    id: GUEST_ID,
    nombre: "Invitado",
    numeroSocio: "I-001",
    credito: moneyToNumber(session.balance),
    estadoPulsera: "activa",
  };
}

async function ensureGuestSession(client: GuestStoreClient) {
  let session = await client.guestSession.findUnique({ where: { id: 1 } });

  if (!session) {
    session = await client.guestSession.create({
      data: { id: 1, balance: SALDO_INICIAL, lastChargeAt: null },
    });
  }

  return session;
}

async function resetGuestIfExpired(client: GuestStoreClient, session: GuestSessionRecord) {
  const balance = parseMoney(session.balance);

  if (balance.greaterThan(0) || !session.lastChargeAt) {
    return session;
  }

  const elapsedMinutes = (Date.now() - session.lastChargeAt.getTime()) / 1000 / 60;

  if (elapsedMinutes < RESET_MINUTOS) {
    return session;
  }

  return client.guestSession.update({
    where: { id: 1 },
    data: { balance: SALDO_INICIAL, lastChargeAt: null },
  });
}

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

export async function getGuestProfile(client?: GuestStoreClient): Promise<GuestProfile> {
  const guestClient = getGuestClient(client);
  const session = await ensureGuestSession(guestClient);
  const currentSession = await resetGuestIfExpired(guestClient, session);

  return toGuestProfile(currentSession);
}

export async function chargeGuest(
  total: Decimal | number | string,
  options: {
    client?: GuestStoreClient;
  } = {},
): Promise<
  | { ok: true; profile: GuestProfile; transactionId: number | null }
  | { ok: false }
> {
  const guestClient = getGuestClient(options.client);
  const amount = parseMoney(total);
  const session = await ensureGuestSession(guestClient);
  const currentSession = await resetGuestIfExpired(guestClient, session);
  const currentBalance = parseMoney(currentSession.balance);

  if (currentBalance.lessThan(amount)) {
    return { ok: false };
  }

  const updatedSession = await guestClient.guestSession.update({
    where: { id: 1 },
    data: {
      balance: { decrement: amount },
      lastChargeAt: new Date(),
    },
  });

  return {
    ok: true,
    profile: toGuestProfile(updatedSession),
    transactionId: null,
  };
}

export const GUEST_ID_CONST = GUEST_ID;
