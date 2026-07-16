-- CreateEnum
CREATE TYPE "PermisoPunto" AS ENUM ('barra', 'caja');

-- CreateTable
CREATE TABLE "PuntoVenta" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "permiso" "PermisoPunto" NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PuntoVenta_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PuntoVenta_nombre_key" ON "PuntoVenta"("nombre");

-- AlterTable
ALTER TABLE "Transaccion" ADD COLUMN "puntoVentaId" INTEGER;

-- AddForeignKey
ALTER TABLE "Transaccion" ADD CONSTRAINT "Transaccion_puntoVentaId_fkey" FOREIGN KEY ("puntoVentaId") REFERENCES "PuntoVenta"("id") ON DELETE SET NULL ON UPDATE CASCADE;
