const GUEST_ID = -1;
const SALDO_INICIAL = 100;
const RESET_MINUTOS = 5;

const store: { saldo: number; lastChargeAt: number | null } = {
  saldo: SALDO_INICIAL,
  lastChargeAt: null,
};

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

export function getGuestProfile() {
  resetIfNeeded();
  return {
    id: GUEST_ID,
    nombre: "Invitado",
    numeroSocio: "I-001",
    credito: store.saldo,
    estadoPulsera: "activa" as const,
  };
}

function resetIfNeeded() {
  if (store.saldo > 0) return;
  if (store.lastChargeAt === null) return;

  const now = Date.now();
  const elapsed = (now - store.lastChargeAt) / 1000 / 60;
  if (elapsed >= RESET_MINUTOS) {
    store.saldo = SALDO_INICIAL;
    store.lastChargeAt = null;
  }
}

export function chargeGuest(total: number): boolean {
  if (store.saldo < total) return false;
  store.saldo -= total;
  store.lastChargeAt = Date.now();
  return true;
}

export const GUEST_ID_CONST = GUEST_ID;
