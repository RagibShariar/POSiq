"use client";

import { Ban, Building2, CircleCheck, Receipt, Sparkles, Users } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
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
import { api, ApiRequestError } from "@/lib/api";

interface Stats {
  businesses: { total: number; byPlan: Record<string, number> };
  users: number;
  orders: { allTime: { count: number; value: number }; thisMonth: { count: number; value: number } };
  ai: { queries: number; tokens: number; costUsd: number };
}

interface BizRow {
  id: string;
  name: string;
  type: string;
  email: string;
  isActive: boolean;
  createdAt: string;
  subscription?: { plan: string; status: string } | null;
  _count: { users: number; branches: number };
}

interface AiUsageRow {
  business: { id: string; name: string; subscription?: { plan: string } | null };
  queries: number;
  tokens: number;
  costUsd: number;
}

const money = (n: number) => `৳${n.toLocaleString()}`;

export default function AdminPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [businesses, setBusinesses] = useState<BizRow[] | null>(null);
  const [aiUsage, setAiUsage] = useState<AiUsageRow[]>([]);

  const load = useCallback(() => {
    api.get<Stats>("/admin/stats").then((r) => setStats(r.data)).catch(() => toast.error("Failed to load stats"));
    api
      .get<BizRow[]>("/admin/businesses?limit=50&includeInactive=true")
      .then((r) => setBusinesses(r.data))
      .catch(() => toast.error("Failed to load businesses"));
    api.get<AiUsageRow[]>("/admin/ai-usage").then((r) => setAiUsage(r.data)).catch(() => {});
  }, []);

  useEffect(load, [load]);

  async function toggleSuspend(b: BizRow) {
    const suspend = b.isActive;
    if (suspend && !confirm(`Suspend "${b.name}"? All their users will be signed out.`)) return;
    try {
      await api.post(`/admin/businesses/${b.id}/suspend${suspend ? "" : "?undo=true"}`);
      toast.success(suspend ? `${b.name} suspended` : `${b.name} reactivated`);
      load();
    } catch (e) {
      toast.error(e instanceof ApiRequestError ? e.message : "Action failed");
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats === null ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />)
        ) : (
          <>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Businesses</CardTitle>
                <Building2 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.businesses.total}</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {Object.entries(stats.businesses.byPlan)
                    .map(([p, n]) => `${p}: ${n}`)
                    .join(" · ")}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Users</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.users}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  GMV this month
                </CardTitle>
                <Receipt className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{money(stats.orders.thisMonth.value)}</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {stats.orders.thisMonth.count} orders · all-time {money(stats.orders.allTime.value)}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">AI usage</CardTitle>
                <Sparkles className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.ai.queries}</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {stats.ai.tokens.toLocaleString()} tokens · ${stats.ai.costUsd.toFixed(4)}
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Businesses</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {businesses === null ? (
            <Skeleton className="m-4 h-40" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Business</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead className="text-right">Users</TableHead>
                  <TableHead className="text-right">Branches</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {businesses.map((b) => (
                  <TableRow key={b.id} className={b.isActive ? "" : "opacity-60"}>
                    <TableCell>
                      <div className="font-medium">{b.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {b.email} · {b.type}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{b.subscription?.plan ?? "—"}</Badge>
                    </TableCell>
                    <TableCell className="text-right">{b._count.users}</TableCell>
                    <TableCell className="text-right">{b._count.branches}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(b.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      {b.isActive ? (
                        <Badge variant="secondary" className="bg-emerald-100 text-emerald-800">
                          Active
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="bg-red-100 text-red-700">
                          Suspended
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className={b.isActive ? "text-red-600" : "text-emerald-600"}
                        onClick={() => toggleSuspend(b)}
                      >
                        {b.isActive ? (
                          <>
                            <Ban className="mr-1 h-4 w-4" /> Suspend
                          </>
                        ) : (
                          <>
                            <CircleCheck className="mr-1 h-4 w-4" /> Reactivate
                          </>
                        )}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {aiUsage.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">AI usage by business</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Business</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead className="text-right">Queries</TableHead>
                  <TableHead className="text-right">Tokens</TableHead>
                  <TableHead className="text-right">Cost (USD)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {aiUsage.map((u) => (
                  <TableRow key={u.business.id}>
                    <TableCell className="font-medium">{u.business.name}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{u.business.subscription?.plan ?? "—"}</Badge>
                    </TableCell>
                    <TableCell className="text-right">{u.queries}</TableCell>
                    <TableCell className="text-right">{u.tokens.toLocaleString()}</TableCell>
                    <TableCell className="text-right">${u.costUsd.toFixed(4)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
