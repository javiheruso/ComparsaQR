import { Decimal } from "@prisma/client/runtime/client";

export type MoneyInput = string | number | Decimal;

export const MONEY_SCALE = 2;

export class MoneyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MoneyError";
  }
}

function toDecimal(value: MoneyInput): Decimal {
  try {
    return value instanceof Decimal ? value : new Decimal(value);
  } catch {
    throw new MoneyError("Money value must be a valid decimal number");
  }
}

function toCanonicalDecimal(value: Decimal): Decimal {
  return value.toDecimalPlaces(MONEY_SCALE, Decimal.ROUND_HALF_UP);
}

function hasCanonicalScale(value: Decimal): boolean {
  return value.equals(toCanonicalDecimal(value));
}

export function parseMoney(
  value: MoneyInput,
  options: { mode?: "normalize" | "reject" } = {}
): Decimal {
  const decimal = toDecimal(value);
  const mode = options.mode ?? "normalize";

  if (mode === "reject" && !hasCanonicalScale(decimal)) {
    throw new MoneyError("Money value must already be canonical");
  }

  return toCanonicalDecimal(decimal);
}

export function normalizeMoney(value: MoneyInput): Decimal {
  return parseMoney(value, { mode: "normalize" });
}

export function addMoney(left: MoneyInput, right: MoneyInput): Decimal {
  return toCanonicalDecimal(parseMoney(left).plus(parseMoney(right)));
}

export function subtractMoney(left: MoneyInput, right: MoneyInput): Decimal {
  return toCanonicalDecimal(parseMoney(left).minus(parseMoney(right)));
}

export function serializeMoney(value: MoneyInput): string {
  return parseMoney(value).toFixed(MONEY_SCALE);
}

export function moneyToNumber(value: MoneyInput): number {
  return Number(serializeMoney(value));
}
