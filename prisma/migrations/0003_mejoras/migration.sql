-- CreateTable
CREATE TABLE "RateLimit" (
    "id" SERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,
    "resetAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RateLimit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GuestSession" (
    "id" SERIAL NOT NULL,
    "balance" DOUBLE PRECISION NOT NULL DEFAULT 100,
    "lastChargeAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GuestSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RateLimit_key_key" ON "RateLimit"("key");

-- CreateSequence for atomic socio number generation
CREATE SEQUENCE IF NOT EXISTS "Socio_numero_sequence" START 1;

-- Insert default guest session
INSERT INTO "GuestSession" (id, balance, "lastChargeAt") VALUES (1, 100, NULL) ON CONFLICT DO NOTHING;

-- Indexes for search performance
CREATE INDEX IF NOT EXISTS "Socio_nombre_idx" ON "Socio"("nombre");
CREATE INDEX IF NOT EXISTS "Socio_apellido1_idx" ON "Socio"("apellido1");
CREATE INDEX IF NOT EXISTS "Socio_apellido2_idx" ON "Socio"("apellido2");
CREATE INDEX IF NOT EXISTS "Socio_numeroSocio_idx" ON "Socio"("numeroSocio");
CREATE INDEX IF NOT EXISTS "Transaccion_socioId_idx" ON "Transaccion"("socioId");
CREATE INDEX IF NOT EXISTS "Transaccion_createdAt_idx" ON "Transaccion"("createdAt" DESC);
CREATE INDEX IF NOT EXISTS "Transaccion_tipo_idx" ON "Transaccion"("tipo");
