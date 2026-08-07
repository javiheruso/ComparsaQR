import { describe, expect, it } from "vitest";
import { Decimal } from "@prisma/client/runtime/client";

import { serializeProduct, serializeProducts } from "@/lib/product-serialization";

describe("product serialization", () => {
  it("normalizes Prisma Decimal prices into numbers", () => {
    const product = serializeProduct({
      id: 1,
      nombre: "Agua",
      precio: new Decimal("2.50"),
      imagen: "",
    });

    expect(product).toEqual({
      id: 1,
      nombre: "Agua",
      precio: 2.5,
      imagen: "",
    });
  });

  it("normalizes product collections", () => {
    const products = serializeProducts([
      { id: 1, nombre: "Agua", precio: new Decimal("2.50"), imagen: "" },
      { id: 2, nombre: "Refresco", precio: new Decimal("3.00"), imagen: "" },
    ]);

    expect(products).toEqual([
      { id: 1, nombre: "Agua", precio: 2.5, imagen: "" },
      { id: 2, nombre: "Refresco", precio: 3, imagen: "" },
    ]);
  });
});
