"use client";

import { ArrowDownRight, ArrowUpRight, Download } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  DateRangePicker,
  lastNDays,
  rangeLabel,
  type DateRangeValue,
} from "@/components/date-range-picker";
import { methodColor, methodLabel } from "@/components/pos/payment-methods";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { api } from "@/lib/api";
import type { ProductReport, SalesReport, SummaryReport } from "@/lib/types";

const money = (n: number) => `৳${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
const money2 = (n: number) => `৳${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;

const colorFor = (method: string) => methodColor(method);
const labelFor = (method: string) => methodLabel(method);

function downloadCsv(filename: string, rows: Record<string, string | number>[]) {
  if (rows.length === 0) return;
  const headers = Object.keys(rows[0]);
  const esc = (v: string | number) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const csv = [
    headers.join(","),
    ...rows.map((r) => headers.map((h) => esc(r[h])).join(",")),
  ].join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function Delta({ pct }: { pct: number | null }) {
  if (pct === null) return <span className="text-xs text-muted-foreground">—</span>;
  const up = pct >= 0;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-xs font-medium ${up ? "text-emerald-600" : "text-red-600"}`}
    >
      <Icon className="h-3 w-3" />
      {Math.abs(pct)}% vs yesterday
    </span>
  );
}

function Stat({
  label,
  value,
  accent,
  sub,
}: {
  label: string;
  value: string;
  accent?: boolean;
  sub?: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border bg-background p-3">
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className={`mt-1 font-bold ${accent ? "text-2xl text-primary" : "text-xl"}`}>{value}</div>
      {sub && <div className="mt-0.5">{sub}</div>}
    </div>
  );
}

export default function DashboardPage() {
  const [summary, setSummary] = useState<SummaryReport | null>(null);
  const [sales, setSales] = useState<SalesReport | null>(null);
  const [products, setProducts] = useState<ProductReport | null>(null);
  const [range, setRange] = useState<DateRangeValue>(() => lastNDays(30));
  const [error, setError] = useState<string | null>(null);

  // Today's snapshot — independent of the selected range.
  useEffect(() => {
    api
      .get<SummaryReport>("/reports/summary")
      .then((s) => setSummary(s.data))
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load dashboard"));
  }, []);

  // Analytical sections follow the selected date range (debounced).
  const loadRange = useCallback(() => {
    const q = `from=${range.from}&to=${range.to}`;
    api.get<SalesReport>(`/reports/sales?${q}`).then((r) => setSales(r.data)).catch(() => {});
    api
      .get<ProductReport>(`/reports/products?${q}&limit=8`)
      .then((r) => setProducts(r.data))
      .catch(() => {});
  }, [range]);

  useEffect(() => {
    if (!range.from || !range.to) return;
    const t = setTimeout(loadRange, 300);
    return () => clearTimeout(t);
  }, [loadRange, range.from, range.to]);

  if (error) return <p className="text-sm text-destructive">{error}</p>;

  if (!summary || !sales || !products) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-40" />
        <div className="grid gap-4 lg:grid-cols-3">
          <Skeleton className="h-72 lg:col-span-2" />
          <Skeleton className="h-72" />
        </div>
      </div>
    );
  }

  const t = summary.today;
  const period = rangeLabel(range);
  const Period = ({ label }: { label: string }) => (
    <span className="ml-1 text-sm font-normal text-muted-foreground">({label})</span>
  );
  const incomeTotal = sales.byPaymentMethod.reduce((s, m) => s + m.revenue, 0);
  const orderStatRows = [
    { metric: "Total orders", value: sales.totals.orders },
    { metric: "Total items sold", value: sales.orderStats.itemsSold },
    { metric: "Average order value", value: money2(sales.totals.avgOrderValue) },
    { metric: "Cancelled (refunded) orders", value: sales.orderStats.cancelled },
    { metric: "Void orders", value: sales.orderStats.voided },
    { metric: "Discounted orders", value: sales.orderStats.discounted },
  ];

  return (
    <div className="space-y-6">
      {/* ── Date range (drives the analytical sections below) ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Dashboard</h2>
        <DateRangePicker value={range} onChange={setRange} />
      </div>

      {/* ── Total Sales (today) ───────────────────────── */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base">
            Total Sales <Period label="Today" />
          </CardTitle>
          <Delta pct={summary.deltas.revenuePct} />
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <Stat label="Today's revenue" value={money(t.netRevenue)} accent />
            <Stat label="Gross sales" value={money(t.grossRevenue)} />
            <Stat label="Net sales" value={money(t.netRevenue)} />
            <Stat label="Total tax" value={money(t.totalTax)} />
            <Stat label="Items sold today" value={String(t.itemsSold)} />
            <Stat
              label="Total orders"
              value={String(t.orders)}
              sub={<Delta pct={summary.deltas.ordersPct} />}
            />
          </div>
        </CardContent>
      </Card>

      {/* ── Revenue chart + payment methods ───────────── */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">
              Revenue <Period label={period} />
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() => downloadCsv(`revenue_${range.from}_${range.to}`, sales.daily)}
            >
              <Download className="mr-1 h-4 w-4" /> Download
            </Button>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={sales.daily} margin={{ left: 4, right: 8, top: 4 }}>
                <defs>
                  <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={48} />
                <Tooltip formatter={(value) => [money(Number(value ?? 0)), "Revenue"]} />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  fill="url(#rev)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">
              Payment methods <Period label={period} />
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                downloadCsv(
                  `payment-methods_${range.from}_${range.to}`,
                  sales.byPaymentMethod.map((m) => ({
                    method: labelFor(m.method),
                    orders: m.orders,
                    revenue: m.revenue,
                  }))
                )
              }
            >
              <Download className="mr-1 h-4 w-4" /> Download
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {sales.byPaymentMethod.length === 0 && (
              <p className="text-sm text-muted-foreground">No sales yet.</p>
            )}
            {sales.byPaymentMethod.map((m, i) => {
              const share = incomeTotal > 0 ? Math.round((m.revenue / incomeTotal) * 100) : 0;
              return (
                <div key={m.method}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="font-medium">{labelFor(m.method)}</span>
                    <span className="text-muted-foreground">
                      {money(m.revenue)} · {share}%
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-muted">
                    <div
                      className="h-2 rounded-full"
                      style={{ width: `${share}%`, backgroundColor: colorFor(m.method) }}
                    />
                  </div>
                </div>
              );
            })}
            <div className="border-t pt-3 text-sm text-muted-foreground">
              Net revenue:{" "}
              <span className="font-semibold text-foreground">{money(sales.totals.netRevenue)}</span>{" "}
              from {sales.totals.orders} orders
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Income overview (pie) + order statistics ──── */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">
              Income overview <Period label={period} />
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                downloadCsv(
                  `income-overview_${range.from}_${range.to}`,
                  sales.byPaymentMethod.map((m) => ({
                    source: labelFor(m.method),
                    amount: m.revenue,
                    percent: incomeTotal > 0 ? Math.round((m.revenue / incomeTotal) * 1000) / 10 : 0,
                    orders: m.orders,
                  }))
                )
              }
            >
              <Download className="mr-1 h-4 w-4" /> Download
            </Button>
          </CardHeader>
          <CardContent>
            {incomeTotal === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">No income yet.</p>
            ) : (
              <div className="flex flex-col items-center gap-4 sm:flex-row">
                <div className="h-44 w-44 shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={sales.byPaymentMethod}
                        dataKey="revenue"
                        nameKey="method"
                        innerRadius={45}
                        outerRadius={80}
                        paddingAngle={2}
                      >
                        {sales.byPaymentMethod.map((m, i) => (
                          <Cell key={m.method} fill={colorFor(m.method)} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value, _n, item) => [
                          money(Number(value ?? 0)),
                          labelFor((item?.payload as { method: string })?.method ?? ""),
                        ]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex-1 space-y-2">
                  {sales.byPaymentMethod.map((m, i) => {
                    const pct = incomeTotal > 0 ? (m.revenue / incomeTotal) * 100 : 0;
                    return (
                      <div key={m.method} className="flex items-center gap-2 text-sm">
                        <span
                          className="h-3 w-3 shrink-0 rounded-full"
                          style={{ backgroundColor: colorFor(m.method) }}
                        />
                        <span className="flex-1 font-medium">{labelFor(m.method)}</span>
                        <span className="text-right">
                          <span className="font-semibold">{money(m.revenue)}</span>
                          <span className="ml-2 text-xs text-muted-foreground">
                            {pct.toFixed(1)}% · {m.orders} order{m.orders === 1 ? "" : "s"}
                          </span>
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Order statistics <Period label={period} />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableBody>
                {orderStatRows.map((r) => (
                  <TableRow key={r.metric}>
                    <TableCell className="text-muted-foreground">{r.metric}</TableCell>
                    <TableCell className="text-right font-semibold">{r.value}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* ── Top selling items ─────────────────────────── */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">
            Top selling items <Period label={period} />
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              downloadCsv(
                `top-selling-items_${range.from}_${range.to}`,
                products.topProducts.map((p) => ({
                  name: p.name,
                  quantitySold: p.quantitySold,
                  revenue: p.revenue,
                  orders: p.orderCount,
                }))
              )
            }
          >
            <Download className="mr-1 h-4 w-4" /> Download
          </Button>
        </CardHeader>
        <CardContent>
          {products.topProducts.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No sales in this period.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10 text-center">#</TableHead>
                  <TableHead>Item</TableHead>
                  <TableHead className="text-right">Qty sold</TableHead>
                  <TableHead className="text-right">Orders</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.topProducts.map((p, i) => (
                  <TableRow key={p.productId}>
                    <TableCell className="text-center text-muted-foreground">{i + 1}</TableCell>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell className="text-right">{p.quantitySold}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{p.orderCount}</TableCell>
                    <TableCell className="text-right font-semibold">{money(p.revenue)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
