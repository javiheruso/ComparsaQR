import { describe, expect, it } from "vitest";

import {
  addMoney,
  moneyToNumber,
  normalizeMoney,
  parseMoney,
  serializeMoney,
} from "@/lib/money";

describe("money primitives", () => {
  it("round-trips canonical amounts exactly", () => {
    const amount = parseMoney("10.00", { mode: "reject" });

    expect(serializeMoney(amount)).toBe("10.00");
    expect(moneyToNumber(amount)).toBe(10);
  });

  it("adds decimal amounts without float drift", () => {
    const total = addMoney("0.10", "0.20");

    expect(serializeMoney(total)).toBe("0.30");
    expect(moneyToNumber(total)).toBe(0.3);
  });

  it("normalizes non-canonical amounts with the shared rounding policy", () => {
    const normalized = normalizeMoney("1.005");

    expect(serializeMoney(normalized)).toBe("1.01");
  });

  it("rejects non-canonical amounts in strict mode", () => {
    expect(() => parseMoney("1.005", { mode: "reject" })).toThrow(
      "Money value must already be canonical"
    );
  });
});
