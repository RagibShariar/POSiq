"use client";

import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Banknote,
  PackageOpen,
  Receipt,
  ShoppingBasket,
} from "lucide-react";
import { useEffect, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import type { SalesReport, SummaryReport } from "@/lib/types";

function formatMoney(n: number) {
  return `৳${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

function Delta({ pct }: { pct: number | null }) {
  if (pct === null) return null;
  const up = pct >= 0;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-xs font-medium ${
        up ? "text-emerald-600" : "text-red-600"
      }`}
    >
      <Icon className="h-3 w-3" />
      {Math.abs(pct)}% vs yesterday
    </span>
  );
}

function KpiCard({
  title,
  value,
  icon: Icon,
  sub,
}: {
  title: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  sub?: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {sub && <div className="mt-1">{sub}</div>}
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const [summary, setSummary] = useState<SummaryReport | null>(null);
  const [sales, setSales] = useState<SalesReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      api.get<SummaryReport>("/reports/summary"),
      api.get<SalesReport>("/reports/sales"),
    ])
      .then(([s, sl]) => {
        setSummary(s.data);
        setSales(sl.data);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load dashboard"));
  }, []);

  if (error) {
    return <p className="text-sm text-destructive">{error}</p>;
  }

  if (!summary || !sales) {
    return (
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <Skeleton className="h-72" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title="Today's revenue"
          value={formatMoney(summary.today.netRevenue)}
          icon={Banknote}
          sub={<Delta pct={summary.deltas.revenuePct} />}
        />
        <KpiCard
          title="Orders today"
          value={String(summary.today.orders)}
          icon={Receipt}
          sub={<Delta pct={summary.deltas.ordersPct} />}
        />
        <KpiCard
          title="Items sold today"
          value={String(summary.today.itemsSold)}
          icon={ShoppingBasket}
        />
        <KpiCard
          title="Low stock items"
          value={String(summary.lowStockCount)}
          icon={summary.lowStockCount > 0 ? AlertTriangle : PackageOpen}
          sub={
            summary.lowStockCount > 0 ? (
              <span className="text-xs text-amber-600">Needs restocking</span>
            ) : (
              <span className="text-xs text-muted-foreground">All stocked</span>
            )
          }
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Revenue — last 30 days</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={sales.daily} margin={{ left: 4, right: 8, top: 4 }}>
                <defs>
                  <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-chart-1)" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="var(--color-chart-1)" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={48} />
                <Tooltip
                  formatter={(value) => [formatMoney(Number(value ?? 0)), "Revenue"]}
                  labelClassName="text-xs"
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="var(--color-chart-1)"
                  strokeWidth={2}
                  fill="url(#rev)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Payment methods — 30 days</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {sales.byPaymentMethod.length === 0 && (
              <p className="text-sm text-muted-foreground">No sales yet.</p>
            )}
            {sales.byPaymentMethod.map((m) => {
              const share =
                sales.totals.grossRevenue > 0
                  ? Math.round((m.revenue / sales.totals.grossRevenue) * 100)
                  : 0;
              return (
                <div key={m.method}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="font-medium">
                      {m.method.replace("_", " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase())}
                    </span>
                    <span className="text-muted-foreground">
                      {formatMoney(m.revenue)} · {share}%
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-muted">
                    <div
                      className="h-2 rounded-full bg-primary"
                      style={{ width: `${share}%` }}
                    />
                  </div>
                </div>
              );
            })}
            <div className="border-t pt-3 text-sm text-muted-foreground">
              30-day net revenue:{" "}
              <span className="font-semibold text-foreground">
                {formatMoney(sales.totals.netRevenue)}
              </span>{" "}
              from {sales.totals.orders} orders
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
