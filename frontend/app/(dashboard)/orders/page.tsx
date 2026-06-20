"use client";

import { Ban, Eye, RotateCcw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Hint } from "@/components/ui/hint";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DateRangePicker, type DateRangeValue } from "@/components/date-range-picker";
import { methodLabel } from "@/components/pos/payment-methods";
import { api, ApiRequestError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { platformLabel } from "@/lib/platforms";
import type { ListMeta } from "@/lib/types";

interface OrderRow {
  id: string;
  orderNumber: string;
  customerName?: string | null;
  customerPhone?: string | null;
  platform?: string;
  platformOrderId?: string | null;
  totalAmount: string | number;
  paymentMethod: string;
  status: string;
  createdAt: string;
  cashier: { name: string };
  branch: { name: string; code: string };
  items: {
    id: string;
    productName: string;
    variationName?: string | null;
    quantity: number;
    unitPrice: string | number;
    subtotal: string | number;
    specialNote?: string | null;
    modifiers?: { id: string; name: string; price: string | number; quantity: number }[];
  }[];
  payments?: { id: string; method: string; amount: string | number; reference?: string | null; changeGiven?: string | number | null }[];
  refunds?: { id: string; amount: string | number; reason?: string | null; createdAt: string }[];
}

const money = (n: string | number) => `৳${Number(n).toLocaleString()}`;

const STATUS_STYLE: Record<string, string> = {
  COMPLETED: "bg-emerald-100 text-emerald-800",
  REFUNDED: "bg-red-100 text-red-700",
  PARTIALLY_REFUNDED: "bg-amber-100 text-amber-800",
  VOIDED: "bg-slate-200 text-slate-600",
};

export default function OrdersPage() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<OrderRow[] | null>(null);
  const [meta, setMeta] = useState<ListMeta | null>(null);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("all");
  const [platform, setPlatform] = useState("all");
  const [dateRange, setDateRange] = useState<DateRangeValue>({ from: "", to: "" });
  const [detail, setDetail] = useState<OrderRow | null>(null);
  const [refundFor, setRefundFor] = useState<OrderRow | null>(null);
  const [refundAmount, setRefundAmount] = useState("");
  const [refundReason, setRefundReason] = useState("");
  const [busy, setBusy] = useState(false);

  const canManage = user && user.role !== "CASHIER";

  const load = useCallback(() => {
    const statusQ = status !== "all" ? `&status=${status}` : "";
    const platformQ = platform !== "all" ? `&platform=${platform}` : "";
    const fromQ = dateRange.from ? `&from=${dateRange.from}` : "";
    const toQ = dateRange.to ? `&to=${dateRange.to}` : "";
    api
      .get<OrderRow[]>(`/orders?page=${page}&limit=20${statusQ}${platformQ}${fromQ}${toQ}`)
      .then((res) => {
        setOrders(res.data);
        setMeta(res.meta ?? null);
      })
      .catch(() => toast.error("Failed to load orders"));
  }, [page, status, platform, dateRange.from, dateRange.to]);

  useEffect(load, [load]);

  async function openDetail(id: string) {
    try {
      const res = await api.get<OrderRow>(`/orders/${id}`);
      setDetail(res.data);
    } catch {
      toast.error("Failed to load order");
    }
  }

  async function voidOrder(order: OrderRow) {
    if (!confirm(`Void ${order.orderNumber}? Stock will be restored.`)) return;
    try {
      await api.patch(`/orders/${order.id}/void`);
      toast.success("Order voided — stock restored");
      setDetail(null);
      load();
    } catch (e) {
      toast.error(e instanceof ApiRequestError ? e.message : "Void failed");
    }
  }

  async function submitRefund(e: React.FormEvent) {
    e.preventDefault();
    if (!refundFor) return;
    setBusy(true);
    try {
      await api.post(`/orders/${refundFor.id}/refund`, {
        amount: Number(refundAmount),
        method: refundFor.paymentMethod,
        ...(refundReason ? { reason: refundReason } : {}),
      });
      toast.success("Refund processed");
      setRefundFor(null);
      setDetail(null);
      load();
    } catch (err) {
      toast.error(err instanceof ApiRequestError ? err.message : "Refund failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={status}
          onValueChange={(v) => {
            setStatus(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="COMPLETED">Completed</SelectItem>
            <SelectItem value="PARTIALLY_REFUNDED">Partially refunded</SelectItem>
            <SelectItem value="REFUNDED">Refunded</SelectItem>
            <SelectItem value="VOIDED">Voided</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={platform}
          onValueChange={(v) => {
            setPlatform(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All platforms</SelectItem>
            <SelectItem value="OTHER">In-store</SelectItem>
            <SelectItem value="FOODPANDA">Foodpanda</SelectItem>
            <SelectItem value="PATHAO">Pathao food</SelectItem>
            <SelectItem value="FOODI">Foodi</SelectItem>
          </SelectContent>
        </Select>
        <DateRangePicker
          value={dateRange}
          onChange={(v) => {
            setDateRange(v);
            setPage(1);
          }}
          allowAll
        />
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Order</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Branch</TableHead>
              <TableHead>Cashier</TableHead>
              <TableHead>Platform</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead>Payment</TableHead>
              <TableHead>Status</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders === null && (
              <TableRow>
                <TableCell colSpan={9}>
                  <Skeleton className="h-20 w-full" />
                </TableCell>
              </TableRow>
            )}
            {orders?.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="py-10 text-center text-muted-foreground">
                  No orders found.
                </TableCell>
              </TableRow>
            )}
            {orders?.map((o) => (
              <TableRow key={o.id}>
                <TableCell className="font-medium">{o.orderNumber}</TableCell>
                <TableCell className="text-muted-foreground">
                  {new Date(o.createdAt).toLocaleString([], {
                    dateStyle: "short",
                    timeStyle: "short",
                  })}
                </TableCell>
                <TableCell>{o.branch.code}</TableCell>
                <TableCell className="text-muted-foreground">{o.cashier.name}</TableCell>
                <TableCell>
                  {o.platform && o.platform !== "OTHER" ? (
                    <Badge variant="secondary">{platformLabel(o.platform)}</Badge>
                  ) : (
                    <span className="text-muted-foreground">In-store</span>
                  )}
                </TableCell>
                <TableCell className="text-right font-semibold">{money(o.totalAmount)}</TableCell>
                <TableCell className="text-muted-foreground">{methodLabel(o.paymentMethod)}</TableCell>
                <TableCell>
                  <Badge className={STATUS_STYLE[o.status] ?? ""} variant="secondary">
                    {o.status.replace("_", " ")}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Hint label="View order">
                    <Button variant="ghost" size="icon" onClick={() => openDetail(o.id)}>
                      <Eye className="h-4 w-4" />
                    </Button>
                  </Hint>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {meta && meta.totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Page {meta.page} of {meta.totalPages} · {meta.total} orders
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= meta.totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Order detail */}
      <Dialog open={detail !== null} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="sm:max-w-md">
          {detail && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {detail.orderNumber}
                  <Badge className={STATUS_STYLE[detail.status] ?? ""} variant="secondary">
                    {detail.status.replace("_", " ")}
                  </Badge>
                </DialogTitle>
                <DialogDescription>
                  {new Date(detail.createdAt).toLocaleString()} · {detail.branch.name} ·{" "}
                  {detail.cashier.name}
                  {detail.platform && detail.platform !== "OTHER"
                    ? ` · ${platformLabel(detail.platform)}${detail.platformOrderId ? ` #${detail.platformOrderId}` : ""}`
                    : ""}
                  {detail.customerName || detail.customerPhone
                    ? ` · Customer: ${detail.customerName ?? ""}${detail.customerPhone ? ` (${detail.customerPhone})` : ""}`
                    : ""}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-1.5 text-sm">
                {detail.items.map((i) => (
                  <div key={i.id} className="flex justify-between">
                    <span>
                      {i.productName}
                      {i.variationName ? ` — ${i.variationName}` : ""}{" "}
                      <span className="text-muted-foreground">×{i.quantity}</span>
                      {i.modifiers && i.modifiers.length > 0 && (
                        <span className="block text-xs text-muted-foreground">
                          {i.modifiers
                            .map((m) => `+ ${m.name}${m.quantity > 1 ? ` ×${m.quantity}` : ""}`)
                            .join(", ")}
                        </span>
                      )}
                      {i.specialNote && (
                        <span className="block text-xs italic text-muted-foreground">
                          {i.specialNote}
                        </span>
                      )}
                    </span>
                    <span>{money(i.subtotal)}</span>
                  </div>
                ))}
                <div className="flex justify-between border-t pt-1.5 font-bold">
                  <span>Total</span>
                  <span>{money(detail.totalAmount)}</span>
                </div>
                {detail.payments && detail.payments.length > 0 && (
                  <div className="rounded-md bg-muted p-2 text-xs">
                    {detail.payments.map((p) => (
                      <div key={p.id} className="flex justify-between">
                        <span>
                          {methodLabel(p.method)}
                          {p.reference ? ` · ${p.reference}` : ""}
                          {p.changeGiven && Number(p.changeGiven) > 0
                            ? ` · change ${money(p.changeGiven)}`
                            : ""}
                        </span>
                        <span>{money(p.amount)}</span>
                      </div>
                    ))}
                  </div>
                )}
                {detail.refunds && detail.refunds.length > 0 && (
                  <div className="rounded-md bg-red-50 p-2 text-xs text-red-700">
                    {detail.refunds.map((r) => (
                      <div key={r.id} className="flex justify-between">
                        <span>Refund {r.reason ? `(${r.reason})` : ""}</span>
                        <span>-{money(r.amount)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {canManage && detail.status !== "VOIDED" && detail.status !== "REFUNDED" && (
                <DialogFooter className="gap-2 sm:gap-0">
                  <Button variant="outline" onClick={() => voidOrder(detail)}>
                    <Ban className="mr-1 h-4 w-4" /> Void
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => {
                      setRefundFor(detail);
                      setRefundAmount("");
                      setRefundReason("");
                    }}
                  >
                    <RotateCcw className="mr-1 h-4 w-4" /> Refund
                  </Button>
                </DialogFooter>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Refund dialog */}
      <Dialog open={refundFor !== null} onOpenChange={(o) => !o && setRefundFor(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Refund {refundFor?.orderNumber}</DialogTitle>
            <DialogDescription>
              Order total {refundFor && money(refundFor.totalAmount)}. Partial refunds allowed.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submitRefund} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="rf-amount">Refund amount (৳)</Label>
              <Input
                id="rf-amount"
                type="number"
                min="1"
                required
                value={refundAmount}
                onChange={(e) => setRefundAmount(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rf-reason">Reason (optional)</Label>
              <Input
                id="rf-reason"
                value={refundReason}
                onChange={(e) => setRefundReason(e.target.value)}
                placeholder="Damaged item, wrong order…"
              />
            </div>
            <DialogFooter>
              <Button type="submit" variant="destructive" className="w-full" disabled={busy || !refundAmount}>
                {busy ? "Processing…" : "Process refund"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
