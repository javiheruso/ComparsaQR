import { describe, it, expect } from "vitest";
import { cn, formatEuro } from "@/lib/utils";
import { extractQrToken } from "@/lib/qr";

describe("cn", () => {
  it("should join class names", () => {
    expect(cn("a", "b", "c")).toBe("a b c");
  });

  it("should filter falsy values", () => {
    expect(cn("a", false, undefined, null, "b")).toBe("a b");
  });

  it("should return empty string for no args", () => {
    expect(cn()).toBe("");
  });
});

describe("formatEuro", () => {
  it("should format number as EUR", () => {
    expect(formatEuro(10)).toBe("10,00\u00a0€");
  });

  it("should format zero", () => {
    expect(formatEuro(0)).toBe("0,00\u00a0€");
  });

  it("should format decimals", () => {
    expect(formatEuro(3.5)).toBe("3,50\u00a0€");
  });
});

describe("extractQrToken", () => {
  it("should extract token from QR URL", () => {
    const url = "https://example.com/scanner/result?token=abc-123";
    expect(extractQrToken(url)).toBe("abc-123");
  });

  it("should treat raw text as token", () => {
    expect(extractQrToken("raw-token")).toBe("raw-token");
  });

  it("should reject empty input", () => {
    expect(extractQrToken("")).toBeNull();
    expect(extractQrToken("   ")).toBeNull();
  });

  it("should reject tokens over 200 chars", () => {
    expect(extractQrToken("a".repeat(201))).toBeNull();
  });

  it("should accept tokens up to 200 chars", () => {
    expect(extractQrToken("a".repeat(200))).toBe("a".repeat(200));
  });
});
