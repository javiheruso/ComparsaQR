import type { Prisma } from "@/generated/prisma/client";

export type SocioWithRelations = Prisma.SocioGetPayload<{
  include: { transacciones: true }
}>;

export type SocioBasic = Prisma.SocioGetPayload<{
  select: {
    id: true; numeroSocio: true; nombre: true;
    apellido1: true; apellido2: true; credito: true;
    estadoPulsera: true; qrToken: true;
  }
}>;

export type SocioDetail = Prisma.SocioGetPayload<{
  select: {
    id: true; numeroSocio: true; nombre: true;
    apellido1: true; apellido2: true; dni: true;
    tipoVinculacion: true; fechaNacimiento: true;
    credito: true; estadoPulsera: true; qrToken: true;
  }
}>;

export type ProductoBasic = Prisma.ProductoGetPayload<{
  select: { id: true; nombre: true; precio: true; imagen: true }
}>;

export type TransaccionWithSocio = Prisma.TransaccionGetPayload<{
  include: { socio: { select: { nombre: true; numeroSocio: true } } }
}>;
