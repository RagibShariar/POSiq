"use client";

import { Banknote, CreditCard, Plus, Smartphone, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface PaymentDraft {
  method: "CASH" | "CARD" | "MOBILE_BANKING";
  amount: string;
  reference: string;
  tendered: string;
}

export interface PaymentSubmission {
  method: "CASH" | "CARD" | "MOBILE_BANKING";
  amount: number;
  reference?: string;
  tendered?: number;
}

const METHODS = [
  { id: "CASH" as const, label: "Cash", icon: Banknote, active: "bg-emerald-600 text-white", idle: "bg-emerald-50 text-emerald-700" },
  { id: "CARD" as const, label: "Card", icon: CreditCard, active: "bg-blue-600 text-white", idle: "bg-blue-50 text-blue-700" },
  { id: "MOBILE_BANKING" as const, label: "bKash/Nagad", icon: Smartphone, active: "bg-pink-600 text-white", idle: "bg-pink-50 text-pink-700" },
];

const money = (n: number) => `৳${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

export function PaymentDialog({
  open,
  total,
  busy,
  onClose,
  onComplete,
}: {
  open: boolean;
  total: number;
  busy: boolean;
  onClose: () => void;
  onComplete: (payments: PaymentSubmission[]) => void;
}) {
  const [payments, setPayments] = useState<PaymentDraft[]>([]);

  useEffect(() => {
    if (open) {
      setPayments([{ method: "CASH", amount: String(total), reference: "", tendered: "" }]);
    }
  }, [open, total]);

  const update = (i: number, patch: Partial<PaymentDraft>) =>
    setPayments((p) => p.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));

  const paid = payments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const remaining = Number((total - paid).toFixed(2));

  const totalChange = payments.reduce((s, p) => {
    if (p.method !== "CASH" || !p.tendered) return s;
    const change = (Number(p.tendered) || 0) - (Number(p.amount) || 0);
    return s + Math.max(0, change);
  }, 0);

  const problems: string[] = [];
  if (remaining > 0.009) problems.push(`${money(remaining)} still due`);
  if (remaining < -0.009) problems.push(`Overpaid by ${money(-remaining)}`);
  for (const p of payments) {
    if ((Number(p.amount) || 0) <= 0) problems.push("Every payment needs an amount");
    if (p.method !== "CASH" && !p.reference.trim())
      problems.push(p.method === "CARD" ? "Card approval no. required" : "Transaction ID required");
    if (p.method === "CASH" && p.tendered && Number(p.tendered) < Number(p.amount))
      problems.push("Cash received is less than the amount due");
  }
  const valid = problems.length === 0;

  function addSplit() {
    if (payments.length >= 3 || remaining <= 0) return;
    setPayments((p) => [
      ...p,
      { method: "CARD", amount: String(remaining), reference: "", tendered: "" },
    ]);
  }

  function submit() {
    onComplete(
      payments.map((p) => ({
        method: p.method,
        amount: Number(p.amount),
        ...(p.reference.trim() ? { reference: p.reference.trim() } : {}),
        ...(p.method === "CASH" && p.tendered ? { tendered: Number(p.tendered) } : {}),
      }))
    );
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Take payment</DialogTitle>
        </DialogHeader>

        <div className="flex items-center justify-between rounded-xl bg-slate-900 px-4 py-3 text-white">
          <span className="text-sm">Total due</span>
          <span className="text-2xl font-extrabold">{money(total)}</span>
        </div>

        <div className="max-h-[50vh] space-y-3 overflow-y-auto pr-1">
          {payments.map((p, i) => (
            <div key={i} className="space-y-3 rounded-xl border p-3">
              <div className="flex items-center gap-2">
                <div className="grid flex-1 grid-cols-3 gap-1.5">
                  {METHODS.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => update(i, { method: m.id, reference: "", tendered: "" })}
                      className={`flex flex-col items-center gap-0.5 rounded-lg p-2 text-[11px] font-bold transition ${p.method === m.id ? m.active : m.idle}`}
                    >
                      <m.icon className="h-4 w-4" />
                      {m.label}
                    </button>
                  ))}
                </div>
                {payments.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setPayments((arr) => arr.filter((_, idx) => idx !== i))}
                    className="text-muted-foreground hover:text-red-500"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Amount (৳)</Label>
                  <Input
                    type="number"
                    min="0"
                    value={p.amount}
                    onChange={(e) => update(i, { amount: e.target.value })}
                  />
                </div>
                {p.method === "CASH" ? (
                  <div className="space-y-1">
                    <Label className="text-xs">Customer gave (৳)</Label>
                    <Input
                      type="number"
                      min="0"
                      value={p.tendered}
                      onChange={(e) => update(i, { tendered: e.target.value })}
                      placeholder={p.amount || "0"}
                    />
                  </div>
                ) : (
                  <div className="space-y-1">
                    <Label className="text-xs">
                      {p.method === "CARD" ? "Approval / last 4 digits" : "TrxID"}
                    </Label>
                    <Input
                      value={p.reference}
                      onChange={(e) => update(i, { reference: e.target.value })}
                      placeholder={p.method === "CARD" ? "e.g. 123456" : "e.g. 9HJ2KX1LM4"}
                    />
                  </div>
                )}
              </div>

              {p.method === "CASH" && (
                <div className="flex flex-wrap items-center gap-1.5">
                  {[Number(p.amount) || 0, 500, 1000].map((amt, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => update(i, { tendered: String(amt) })}
                      className="rounded-full border px-2.5 py-1 text-xs font-medium hover:bg-accent"
                    >
                      {idx === 0 ? "Exact" : `৳${amt}`}
                    </button>
                  ))}
                  {p.tendered && Number(p.tendered) >= Number(p.amount) && (
                    <span className="ml-auto rounded-lg bg-emerald-100 px-3 py-1 text-sm font-bold text-emerald-800">
                      Change: {money(Number(p.tendered) - Number(p.amount))}
                    </span>
                  )}
                </div>
              )}
            </div>
          ))}

          {payments.length < 3 && remaining > 0.009 && (
            <Button type="button" variant="outline" size="sm" className="w-full" onClick={addSplit}>
              <Plus className="mr-1 h-4 w-4" /> Split — pay {money(remaining)} another way
            </Button>
          )}
        </div>

        {!valid && (
          <p className="text-xs font-medium text-amber-600">{[...new Set(problems)][0]}</p>
        )}
        {valid && totalChange > 0 && (
          <p className="rounded-lg bg-emerald-50 px-3 py-2 text-center text-lg font-extrabold text-emerald-700">
            Give back {money(totalChange)}
          </p>
        )}

        <Button className="h-12 w-full text-base" disabled={!valid || busy} onClick={submit}>
          {busy ? "Processing…" : `Complete sale · ${money(total)}`}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
