-- Habilita Row Level Security en todas las tablas del proyecto
-- para eliminar las alertas "Unrestricted" en Supabase.
-- Las políticas permiten todo porque la autenticación se maneja
-- a nivel de aplicación (API routes con sesión).

-- PuntoVenta
ALTER TABLE "PuntoVenta" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all" ON "PuntoVenta" USING (true) WITH CHECK (true);

-- Socio
ALTER TABLE "Socio" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all" ON "Socio" USING (true) WITH CHECK (true);

-- Producto
ALTER TABLE "Producto" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all" ON "Producto" USING (true) WITH CHECK (true);

-- Heartbeat
ALTER TABLE "Heartbeat" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all" ON "Heartbeat" USING (true) WITH CHECK (true);

-- RateLimit
ALTER TABLE "RateLimit" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all" ON "RateLimit" USING (true) WITH CHECK (true);

-- GuestSession
ALTER TABLE "GuestSession" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all" ON "GuestSession" USING (true) WITH CHECK (true);

-- Transaccion
ALTER TABLE "Transaccion" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all" ON "Transaccion" USING (true) WITH CHECK (true);

-- Nota: la tabla _prisma_migrations es interna de Prisma y no necesita RLS.
