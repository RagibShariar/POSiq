"use client";

import { Lock, LockOpen } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { api, ApiRequestError } from "@/lib/api";

export interface Register {
  id: string;
  openingBalance: string | number;
  openedAt: string;
}

interface CloseSummary {
  totalOrders: number;
  totalSales: number;
  cashSales: number;
  expectedCash: number;
  closingBalance: number;
  variance: number;
}

export function RegisterControls({
  branchId,
  register,
  onChange,
}: {
  branchId: string;
  register: Register | null;
  onChange: (register: Register | null) => void;
}) {
  const [dialog, setDialog] = useState<"open" | "close" | null>(null);
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState<CloseSummary | null>(null);

  async function openRegister() {
    setBusy(true);
    try {
      const res = await api.post<Register>(`/registers/${branchId}/open`, {
        openingBalance: Number(amount) || 0,
      });
      onChange(res.data);
      setDialog(null);
      setAmount("");
      toast.success("Register opened");
    } catch (e) {
      toast.error(e instanceof ApiRequestError ? e.message : "Failed to open register");
    } finally {
      setBusy(false);
    }
  }

  async function closeRegister() {
    setBusy(true);
    try {
      const res = await api.post<Register & { summary: CloseSummary }>(
        `/registers/${branchId}/close`,
        { closingBalance: Number(amount) || 0 }
      );
      onChange(null);
      setSummary(res.data.summary);
      setDialog(null);
      setAmount("");
    } catch (e) {
      toast.error(e instanceof ApiRequestError ? e.message : "Failed to close register");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {register ? (
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1 text-emerald-600">
            <LockOpen className="h-3 w-3" /> Register open
          </Badge>
          <Button variant="outline" size="sm" onClick={() => setDialog("close")}>
            Close register
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1 text-amber-600">
            <Lock className="h-3 w-3" /> Register closed
          </Badge>
          <Button size="sm" onClick={() => setDialog("open")}>
            Open register
          </Button>
        </div>
      )}

      <Dialog open={dialog !== null} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{dialog === "open" ? "Open register" : "Close register"}</DialogTitle>
            <DialogDescription>
              {dialog === "open"
                ? "Count the cash in the drawer to start the shift."
                : "Count the cash in the drawer to reconcile."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="balance">
              {dialog === "open" ? "Opening balance (৳)" : "Closing balance (৳)"}
            </Label>
            <Input
              id="balance"
              type="number"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button
              onClick={dialog === "open" ? openRegister : closeRegister}
              disabled={busy || amount === ""}
              className="w-full"
            >
              {busy ? "Working…" : dialog === "open" ? "Open register" : "Close register"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={summary !== null} onOpenChange={(o) => !o && setSummary(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Shift summary</DialogTitle>
          </DialogHeader>
          {summary && (
            <div className="space-y-1.5 text-sm">
              {[
                ["Orders", String(summary.totalOrders)],
                ["Total sales", `৳${summary.totalSales.toLocaleString()}`],
                ["Cash sales", `৳${summary.cashSales.toLocaleString()}`],
                ["Expected cash", `৳${summary.expectedCash.toLocaleString()}`],
                ["Counted", `৳${summary.closingBalance.toLocaleString()}`],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between">
                  <span className="text-muted-foreground">{k}</span>
                  <span className="font-medium">{v}</span>
                </div>
              ))}
              <div className="flex justify-between border-t pt-1.5">
                <span className="text-muted-foreground">Variance</span>
                <span
                  className={`font-semibold ${
                    summary.variance === 0
                      ? "text-emerald-600"
                      : summary.variance > 0
                        ? "text-amber-600"
                        : "text-red-600"
                  }`}
                >
                  {summary.variance > 0 ? "+" : ""}৳{summary.variance.toLocaleString()}
                </span>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
