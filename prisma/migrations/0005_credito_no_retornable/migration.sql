-- AlterEnum
ALTER TYPE "TipoTransaccion" ADD VALUE 'devolucion';

-- AlterTable
ALTER TABLE "Socio" ADD COLUMN "creditoNoRetornable" DOUBLE PRECISION NOT NULL DEFAULT 0;
