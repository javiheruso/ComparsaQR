import { z } from "zod";

export const createSocioSchema = z.object({
  nombre: z.string().min(1).max(100),
  apellido1: z.string().max(100).optional(),
  apellido2: z.string().max(100).optional(),
  dni: z.string().max(20).optional(),
  tipoVinculacion: z.enum(["socio", "hijos_mayores", "socios_menores", "hijo_socio"]).optional(),
  fechaNacimiento: z.string().datetime().optional().nullable(),
  credito: z.number().min(0).default(0),
});

export const updateSocioSchema = z.object({
  nombre: z.string().min(1).max(100),
  numeroSocio: z.string().min(1).max(20),
  apellido1: z.string().max(100).nullable().optional(),
  apellido2: z.string().max(100).nullable().optional(),
  dni: z.string().max(20).nullable().optional(),
  tipoVinculacion: z.enum(["socio", "hijos_mayores", "socios_menores", "hijo_socio"]).nullable().optional(),
  fechaNacimiento: z.string().nullable().optional(),
});

export const productoSchema = z.object({
  nombre: z.string().min(1).max(100),
  precio: z.number().min(0),
  imagen: z.string().max(500).default(""),
});

export const consumoSchema = z.object({
  items: z
    .array(
      z.object({
        productoId: z.number().int().positive(),
        cantidad: z.number().int().positive().max(99),
      })
    )
    .min(1)
    .max(50),
});

export const recargaMasivaSchema = z.object({
  tipoVinculacion: z.enum(["socio", "hijos_mayores", "socios_menores", "hijo_socio"]),
  cantidad: z.number().positive(),
  descripcion: z.string().optional(),
});

export const creditoSchema = z.object({
  cantidad: z.number().positive(),
  descripcion: z.string().optional().nullable(),
});

export const loginSchema = z.object({
  password: z.string().min(1),
});
