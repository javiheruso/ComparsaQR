-- AlterTable
ALTER TABLE "GuestSession"
ALTER COLUMN "balance" TYPE DECIMAL(12,2)
USING ROUND("balance"::numeric, 2),
ALTER COLUMN "balance" SET DEFAULT 100.00;

-- AlterTable
ALTER TABLE "Producto"
ALTER COLUMN "precio" TYPE DECIMAL(12,2)
USING ROUND("precio"::numeric, 2);

-- AlterTable
ALTER TABLE "Socio"
ALTER COLUMN "credito" TYPE DECIMAL(12,2)
USING ROUND("credito"::numeric, 2),
ALTER COLUMN "credito" SET DEFAULT 0.00,
ALTER COLUMN "creditoNoRetornable" TYPE DECIMAL(12,2)
USING ROUND("creditoNoRetornable"::numeric, 2),
ALTER COLUMN "creditoNoRetornable" SET DEFAULT 0.00;

-- AlterTable
ALTER TABLE "Transaccion"
ALTER COLUMN "cantidad" TYPE DECIMAL(12,2)
USING ROUND("cantidad"::numeric, 2);

-- CreateTable
CREATE TABLE "IdempotencyRecord" (
    "id" SERIAL NOT NULL,
    "scope" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "responseCode" INTEGER,
    "responseBody" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IdempotencyRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "IdempotencyRecord_scope_key_key" ON "IdempotencyRecord"("scope", "key");

-- CreateIndex
CREATE INDEX "IdempotencyRecord_scope_createdAt_idx" ON "IdempotencyRecord"("scope", "createdAt");
