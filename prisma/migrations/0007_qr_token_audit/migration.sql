-- CreateTable
CREATE TABLE "QrTokenAudit" (
    "id" SERIAL NOT NULL,
    "socioId" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "oldQrToken" TEXT NOT NULL,
    "newQrToken" TEXT,
    "actor" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QrTokenAudit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "QrTokenAudit_socioId_createdAt_idx" ON "QrTokenAudit"("socioId", "createdAt");

-- AddForeignKey
ALTER TABLE "QrTokenAudit" ADD CONSTRAINT "QrTokenAudit_socioId_fkey" FOREIGN KEY ("socioId") REFERENCES "Socio"("id") ON DELETE CASCADE ON UPDATE CASCADE;
