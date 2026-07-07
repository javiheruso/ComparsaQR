import { describe, it, expect } from "vitest";
import { createSocioSchema, productoSchema, loginSchema, consumoSchema } from "@/lib/schemas";

describe("createSocioSchema", () => {
  it("should validate a valid socio", () => {
    const result = createSocioSchema.safeParse({ nombre: "Juan" });
    expect(result.success).toBe(true);
  });

  it("should reject empty name", () => {
    const result = createSocioSchema.safeParse({ nombre: "" });
    expect(result.success).toBe(false);
  });

  it("should set default credit to 0", () => {
    const result = createSocioSchema.parse({ nombre: "Juan" });
    expect(result.credito).toBe(0);
  });

  it("should accept optional fields", () => {
    const result = createSocioSchema.safeParse({
      nombre: "Juan",
      apellido1: "Pérez",
      dni: "12345678A",
      credito: 50,
    });
    expect(result.success).toBe(true);
  });
});

describe("productoSchema", () => {
  it("should validate a valid product", () => {
    const result = productoSchema.safeParse({ nombre: "Cerveza", precio: 3.5 });
    expect(result.success).toBe(true);
  });

  it("should reject negative price", () => {
    const result = productoSchema.safeParse({ nombre: "Cerveza", precio: -1 });
    expect(result.success).toBe(false);
  });
});

describe("loginSchema", () => {
  it("should validate a password", () => {
    const result = loginSchema.safeParse({ password: "secreto" });
    expect(result.success).toBe(true);
  });

  it("should reject empty password", () => {
    const result = loginSchema.safeParse({ password: "" });
    expect(result.success).toBe(false);
  });
});

describe("consumoSchema", () => {
  it("should validate valid items", () => {
    const result = consumoSchema.safeParse({
      items: [{ productoId: 1, cantidad: 2 }],
    });
    expect(result.success).toBe(true);
  });

  it("should reject empty items", () => {
    const result = consumoSchema.safeParse({ items: [] });
    expect(result.success).toBe(false);
  });

  it("should reject too many items", () => {
    const items = Array.from({ length: 51 }, (_, i) => ({
      productoId: i + 1,
      cantidad: 1,
    }));
    const result = consumoSchema.safeParse({ items });
    expect(result.success).toBe(false);
  });
});
