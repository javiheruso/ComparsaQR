import { db } from "@/lib/db";
import Link from "next/link";
import { formatEuro } from "@/lib/utils";
import { ArrowUpDown, Users, CreditCard, QrCode, Package } from "lucide-react";

export const dynamic = "force-dynamic";

async function getDashboardData() {
  try {
    const [totalSocios, activos, creditoTotal, ultimasTransacciones] =
      await Promise.all([
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
      ]);

    return { totalSocios, activos, creditoTotal, ultimasTransacciones };
  } catch {
    return {
      totalSocios: 0,
      activos: 0,
      creditoTotal: { _sum: { credito: 0 } },
      ultimasTransacciones: [],
    };
  }
}

export default async function AdminDashboard() {
  const { totalSocios, activos, creditoTotal, ultimasTransacciones } =
    await getDashboardData();

  const stats = [
    {
      label: "Total Socios",
      value: totalSocios,
      icon: Users,
      color: "text-blue-600",
      bg: "bg-blue-100",
    },
    {
      label: "Pulseras Activas",
      value: activos,
      icon: QrCode,
      color: "text-green-600",
      bg: "bg-green-100",
    },
    {
      label: "Crédito Total",
      value: formatEuro(creditoTotal._sum.credito ?? 0),
      icon: CreditCard,
      color: "text-purple-600",
      bg: "bg-purple-100",
    },
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

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="bg-white border border-border rounded-xl p-4 flex items-center gap-4"
          >
            <div
              className={`w-12 h-12 rounded-lg ${stat.bg} flex items-center justify-center`}
            >
              <stat.icon className={`w-6 h-6 ${stat.color}`} />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{stat.label}</p>
              <p className="text-xl font-bold">{stat.value}</p>
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
