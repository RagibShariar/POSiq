"use client";

import { Download } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { DateRangePicker } from "@/components/date-range-picker";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api, tokenStore } from "@/lib/api";
import type { SalesReport } from "@/lib/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000/api/v1";
const money = (n: string | number) => `৳${Number(n).toLocaleString()}`;

interface ProductReport {
  topProducts: { productId: string; name: string; quantitySold: number; revenue: number }[];
  slowProducts: { productId: string; name: string; quantitySold: number; revenue: number }[];
}

interface CashierRow {
  cashier: { id: string; name: string };
  orders: number;
  revenue: number;
  avgOrderValue: number;
}

interface BranchRow {
  branch: { id: string; name: string; code: string };
  orders: number;
  revenue: number;
  avgOrderValue: number;
}

function daysAgo(n: number) {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export default function ReportsPage() {
  const [from, setFrom] = useState(daysAgo(30));
  const [to, setTo] = useState(daysAgo(0));
  const [sales, setSales] = useState<SalesReport | null>(null);
  const [products, setProducts] = useState<ProductReport | null>(null);
  const [cashiers, setCashiers] = useState<CashierRow[] | null>(null);
  const [branches, setBranches] = useState<BranchRow[] | null>(null);

  const range = `from=${from}&to=${to}`;

  const load = useCallback(() => {
    setSales(null);
    setProducts(null);
    setCashiers(null);
    setBranches(null);
    api.get<SalesReport>(`/reports/sales?${range}`).then((r) => setSales(r.data)).catch(() => toast.error("Failed to load sales report"));
    api.get<ProductReport>(`/reports/products?${range}`).then((r) => setProducts(r.data)).catch(() => {});
    api.get<CashierRow[]>(`/reports/cashiers?${range}`).then((r) => setCashiers(r.data)).catch(() => {});
    api.get<BranchRow[]>(`/reports/branches?${range}`).then((r) => setBranches(r.data)).catch(() => setBranches([]));
  }, [range]);

  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [load]);

  async function exportCsv(report: string) {
    try {
      const res = await fetch(`${API_URL}/reports/${report}?${range}&export=csv`, {
        headers: { Authorization: `Bearer ${tokenStore.access}` },
      });
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${report}-report-${from}-to-${to}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Export failed");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Reports</h2>
        <DateRangePicker
          value={{ from, to }}
          onChange={(v) => {
            setFrom(v.from);
            setTo(v.to);
          }}
        />
      </div>

      {sales && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Gross revenue", money(sales.totals.grossRevenue)],
            ["Refunded", money(sales.totals.refundedAmount)],
            ["Net revenue", money(sales.totals.netRevenue)],
            ["Orders", String(sales.totals.orders)],
          ].map(([k, v]) => (
            <Card key={k}>
              <CardHeader className="pb-1">
                <CardTitle className="text-sm font-medium text-muted-foreground">{k}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{v}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Tabs defaultValue="products">
        <TabsList>
          <TabsTrigger value="products">Products</TabsTrigger>
          <TabsTrigger value="cashiers">Cashiers</TabsTrigger>
          <TabsTrigger value="branches">Branches</TabsTrigger>
        </TabsList>

        <TabsContent value="products" className="space-y-4">
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={() => exportCsv("products")}>
              <Download className="mr-1 h-4 w-4" /> Export CSV
            </Button>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Top sellers</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {products === null ? (
                  <Skeleton className="m-4 h-32" />
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Product</TableHead>
                        <TableHead className="text-right">Sold</TableHead>
                        <TableHead className="text-right">Revenue</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {products.topProducts.map((p) => (
                        <TableRow key={p.productId}>
                          <TableCell className="font-medium">{p.name}</TableCell>
                          <TableCell className="text-right">{p.quantitySold}</TableCell>
                          <TableCell className="text-right">{money(p.revenue)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Slow movers</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {products === null ? (
                  <Skeleton className="m-4 h-32" />
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Product</TableHead>
                        <TableHead className="text-right">Sold</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {products.slowProducts.map((p) => (
                        <TableRow key={p.productId}>
                          <TableCell className="font-medium">{p.name}</TableCell>
                          <TableCell className="text-right">{p.quantitySold}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="cashiers" className="space-y-4">
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={() => exportCsv("cashiers")}>
              <Download className="mr-1 h-4 w-4" /> Export CSV
            </Button>
          </div>
          <div className="rounded-lg border bg-card">
            {cashiers === null ? (
              <Skeleton className="m-4 h-32" />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cashier</TableHead>
                    <TableHead className="text-right">Orders</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                    <TableHead className="text-right">Avg order</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cashiers.map((c) => (
                    <TableRow key={c.cashier.id}>
                      <TableCell className="font-medium">{c.cashier.name}</TableCell>
                      <TableCell className="text-right">{c.orders}</TableCell>
                      <TableCell className="text-right">{money(c.revenue)}</TableCell>
                      <TableCell className="text-right">{money(Math.round(c.avgOrderValue))}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </TabsContent>

        <TabsContent value="branches" className="space-y-4">
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={() => exportCsv("branches")}>
              <Download className="mr-1 h-4 w-4" /> Export CSV
            </Button>
          </div>
          <div className="rounded-lg border bg-card">
            {branches === null ? (
              <Skeleton className="m-4 h-32" />
            ) : branches.length === 0 ? (
              <p className="p-6 text-center text-sm text-muted-foreground">
                Branch comparison is available to owners only.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Branch</TableHead>
                    <TableHead className="text-right">Orders</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                    <TableHead className="text-right">Avg order</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {branches.map((b) => (
                    <TableRow key={b.branch.id}>
                      <TableCell className="font-medium">
                        {b.branch.name}{" "}
                        <span className="text-muted-foreground">({b.branch.code})</span>
                      </TableCell>
                      <TableCell className="text-right">{b.orders}</TableCell>
                      <TableCell className="text-right">{money(b.revenue)}</TableCell>
                      <TableCell className="text-right">{money(Math.round(b.avgOrderValue))}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
