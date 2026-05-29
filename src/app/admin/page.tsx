import { db } from "@/lib/db";
import Link from "next/link";
import { formatEuro } from "@/lib/utils";
import { ArrowUpDown, Users, CreditCard, QrCode, Package, TrendingUp, ShoppingCart } from "lucide-react";

export const dynamic = "force-dynamic";

async function getDashboardData() {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      totalSocios, activos, creditoTotal, ultimasTransacciones,
      transaccionesHoy, totalConsumido, totalCargado,
    ] = await Promise.all([
      db.socio.count(),
      db.socio.count({ where: { estadoPulsera: "activa" } }),
      db.socio.aggregate({ _sum: { credito: true } }),
      db.transaccion.findMany({
        take: 10,
        orderBy: { createdAt: "desc" },
        include: {
          socio: { select: { nombre: true, numeroSocio: true } },
        },
      }),
      db.transaccion.aggregate({
        _sum: { cantidad: true },
        where: { createdAt: { gte: today } },
      }),
      db.transaccion.aggregate({
        _sum: { cantidad: true },
        where: { tipo: "consumo" },
      }),
      db.transaccion.aggregate({
        _sum: { cantidad: true },
        where: { tipo: "carga" },
      }),
    ]);

    return {
      totalSocios,
      activos,
      creditoTotal,
      ultimasTransacciones,
      ventasHoy: transaccionesHoy._sum.cantidad ?? 0,
      totalConsumido: totalConsumido._sum.cantidad ?? 0,
      totalCargado: totalCargado._sum.cantidad ?? 0,
    };
  } catch {
    return {
      totalSocios: 0,
      activos: 0,
      creditoTotal: { _sum: { credito: 0 } },
      ultimasTransacciones: [],
      ventasHoy: 0,
      totalConsumido: 0,
      totalCargado: 0,
    };
  }
}

export default async function AdminDashboard() {
  const { totalSocios, activos, creditoTotal, ultimasTransacciones, ventasHoy, totalConsumido, totalCargado } =
    await getDashboardData();

  const stats = [
    { label: "Total Socios", value: totalSocios, icon: Users, color: "text-blue-600", bg: "bg-blue-100" },
    { label: "Pulseras Activas", value: activos, icon: QrCode, color: "text-green-600", bg: "bg-green-100" },
    { label: "Crédito en Cartera", value: formatEuro(creditoTotal._sum.credito ?? 0), icon: CreditCard, color: "text-purple-600", bg: "bg-purple-100" },
    { label: "Ventas Hoy", value: formatEuro(ventasHoy), icon: TrendingUp, color: "text-emerald-600", bg: "bg-emerald-100" },
    { label: "Total Consumido", value: formatEuro(totalConsumido), icon: ShoppingCart, color: "text-red-600", bg: "bg-red-100" },
    { label: "Total Cargado", value: formatEuro(totalCargado), icon: TrendingUp, color: "text-amber-600", bg: "bg-amber-100" },
  ];

  return (
    <div className="p-6 space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <div className="flex gap-2">
          <Link
            href="/admin/productos"
            className="flex items-center gap-2 px-4 py-2 border border-border rounded-lg text-sm font-medium hover:bg-muted transition-colors"
          >
            <Package className="w-4 h-4" /> Productos
          </Link>
          <Link
            href="/admin/socios/nuevo"
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
          >
            Nuevo Socio
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="bg-white border border-border rounded-xl p-4 flex flex-col items-center gap-2 text-center"
          >
            <div className={`w-10 h-10 rounded-lg ${stat.bg} flex items-center justify-center`}>
              <stat.icon className={`w-5 h-5 ${stat.color}`} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{stat.label}</p>
              <p className="text-lg font-bold">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white border border-border rounded-xl">
        <div className="px-4 py-3 border-b border-border flex items-center gap-2">
          <ArrowUpDown className="w-4 h-4 text-muted-foreground" />
          <h2 className="font-semibold">Últimas Transacciones</h2>
        </div>
        <div className="divide-y divide-border">
          {ultimasTransacciones.length === 0 ? (
            <p className="p-4 text-muted-foreground text-sm">
              No hay transacciones todavía
            </p>
          ) : (
            ultimasTransacciones.map((t) => (
              <div
                key={t.id}
                className="px-4 py-3 flex items-center justify-between"
              >
                <div>
                  <p className="font-medium text-sm">{t.socio.nombre}</p>
                  <p className="text-xs text-muted-foreground">
                    #{t.socio.numeroSocio} &middot;{" "}
                    {t.descripcion ??
                      (t.tipo === "carga"
                        ? "Carga de crédito"
                        : "Consumición")}
                  </p>
                </div>
                <span
                  className={`font-semibold text-sm ${
                    t.tipo === "carga" ? "text-green-600" : "text-red-600"
                  }`}
                >
                  {t.tipo === "carga" ? "+" : "-"}
                  {formatEuro(t.cantidad)}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
