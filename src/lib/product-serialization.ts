import { moneyToNumber } from "@/lib/money";

type ProductLike = {
  id: number;
  nombre: string;
  precio: string | number | { toString(): string };
  imagen: string;
};

export function serializeProduct<T extends ProductLike>(product: T) {
  return {
    ...product,
    precio: moneyToNumber(product.precio as Parameters<typeof moneyToNumber>[0]),
  };
}

export function serializeProducts<T extends ProductLike>(products: T[]) {
  return products.map(serializeProduct);
}
