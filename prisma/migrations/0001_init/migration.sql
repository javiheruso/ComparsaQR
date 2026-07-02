node.exe : Loaded Prisma config from prisma.config.ts.
En línea: 1 Carácter: 1
+ & "C:\Program Files\nodejs/node.exe" "C:\Program Files\nodejs/node_mo ...
+ ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : NotSpecified: (Loaded Prisma c...isma.config.ts.:String) [], RemoteException
    + FullyQualifiedErrorId : NativeCommandError
 

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "TipoVinculacion" AS ENUM ('socio', 'hijos_mayores', 'socios_menores', 'hijo_socio');

-- CreateEnum
CREATE TYPE "EstadoPulsera" AS ENUM ('activa', 'inactiva', 'perdida');

-- CreateEnum
CREATE TYPE "TipoTransaccion" AS ENUM ('carga', 'consumo');

-- CreateTable
CREATE TABLE "Socio" (
    "id" SERIAL NOT NULL,
    "numeroSocio" TEXT NOT NULL,
    "dni" TEXT,
    "nombre" TEXT NOT NULL,
    "apellido1" TEXT,
    "apellido2" TEXT,
    "tipoVinculacion" "TipoVinculacion" NOT NULL DEFAULT 'socio',
    "fechaNacimiento" TIMESTAMP(3),
    "credito" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "estadoPulsera" "EstadoPulsera" NOT NULL DEFAULT 'activa',
    "qrToken" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Socio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Producto" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "precio" DOUBLE PRECISION NOT NULL,
    "imagen" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Producto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Heartbeat" (
    "id" SERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Heartbeat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaccion" (
    "id" SERIAL NOT NULL,
    "socioId" INTEGER NOT NULL,
    "tipo" "TipoTransaccion" NOT NULL,
    "cantidad" DOUBLE PRECISION NOT NULL,
    "descripcion" TEXT,
    "operador" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Transaccion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Socio_numeroSocio_key" ON "Socio"("numeroSocio");

-- CreateIndex
CREATE UNIQUE INDEX "Socio_dni_key" ON "Socio"("dni");

-- CreateIndex
CREATE UNIQUE INDEX "Socio_qrToken_key" ON "Socio"("qrToken");

-- CreateIndex
CREATE UNIQUE INDEX "Heartbeat_key_key" ON "Heartbeat"("key");

-- AddForeignKey
ALTER TABLE "Transaccion" ADD CONSTRAINT "Transaccion_socioId_fkey" FOREIGN KEY ("socioId") REFERENCES "Socio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

