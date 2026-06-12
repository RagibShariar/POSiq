"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api, ApiRequestError } from "@/lib/api";

interface BusinessProfile {
  name: string;
  type: string;
  email: string;
  phone?: string | null;
  address?: string | null;
  currency: string;
  timezone: string;
  subscription?: { plan: string; status: string; currentPeriodEnd: string } | null;
}

interface ReceiptSettings {
  headerText: string;
  footerText: string;
  showLogo: boolean;
  showCashier: boolean;
}

interface Subscription {
  plan: string;
  status: string;
  currentPeriodEnd: string;
  monthlyPrice: number;
  limits: { users: number | null; products: number | null; aiQueriesPerDay: number | null };
  usage: { users: number; products: number; aiQueriesToday: number };
}

interface Invoice {
  id: string;
  plan: string;
  amount: string | number;
  createdAt: string;
  note?: string | null;
}

const PLANS = [
  { id: "FREE", price: 0, blurb: "1 user · 100 products · 5 AI/day" },
  { id: "STARTER", price: 999, blurb: "3 users · 500 products · 50 AI/day" },
  { id: "PRO", price: 2999, blurb: "10 users · unlimited products · unlimited AI" },
];

export default function SettingsPage() {
  const [profile, setProfile] = useState<BusinessProfile | null>(null);
  const [receipt, setReceipt] = useState<ReceiptSettings | null>(null);
  const [sub, setSub] = useState<Subscription | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get<BusinessProfile>("/business").then((r) => setProfile(r.data)).catch(() => {});
    api.get<ReceiptSettings>("/settings/receipt").then((r) => setReceipt(r.data)).catch(() => {});
    api.get<Subscription>("/subscription").then((r) => setSub(r.data)).catch(() => {});
    api.get<Invoice[]>("/subscription/invoices").then((r) => setInvoices(r.data)).catch(() => {});
  }, []);

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!profile) return;
    setBusy(true);
    try {
      await api.patch("/business", {
        name: profile.name,
        type: profile.type,
        phone: profile.phone || undefined,
        address: profile.address || undefined,
        currency: profile.currency,
        timezone: profile.timezone,
      });
      toast.success("Business profile saved");
    } catch (err) {
      toast.error(err instanceof ApiRequestError ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function saveReceipt(e: React.FormEvent) {
    e.preventDefault();
    if (!receipt) return;
    setBusy(true);
    try {
      await api.patch("/settings/receipt", receipt as unknown as Record<string, unknown>);
      toast.success("Receipt settings saved");
    } catch (err) {
      toast.error(err instanceof ApiRequestError ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function changePlan(plan: string) {
    if (!confirm(`Switch to the ${plan} plan?`)) return;
    try {
      await api.post("/subscription/upgrade", { plan });
      toast.success(`Plan changed to ${plan}`);
      const r = await api.get<Subscription>("/subscription");
      setSub(r.data);
      const inv = await api.get<Invoice[]>("/subscription/invoices");
      setInvoices(inv.data);
    } catch (err) {
      toast.error(err instanceof ApiRequestError ? err.message : "Plan change failed");
    }
  }

  return (
    <Tabs defaultValue="business" className="max-w-3xl space-y-4">
      <TabsList>
        <TabsTrigger value="business">Business</TabsTrigger>
        <TabsTrigger value="receipt">Receipt</TabsTrigger>
        <TabsTrigger value="subscription">Subscription</TabsTrigger>
      </TabsList>

      <TabsContent value="business">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Business profile</CardTitle>
            <CardDescription>Shown on receipts and used by the AI assistant.</CardDescription>
          </CardHeader>
          <CardContent>
            {profile && (
              <form onSubmit={saveProfile} className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Business name</Label>
                  <Input
                    value={profile.name}
                    onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Input
                    value={profile.type}
                    onChange={(e) => setProfile({ ...profile, type: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input
                    value={profile.phone ?? ""}
                    onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Currency</Label>
                  <Input
                    value={profile.currency}
                    maxLength={3}
                    onChange={(e) => setProfile({ ...profile, currency: e.target.value.toUpperCase() })}
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Address</Label>
                  <Input
                    value={profile.address ?? ""}
                    onChange={(e) => setProfile({ ...profile, address: e.target.value })}
                  />
                </div>
                <Button type="submit" disabled={busy} className="sm:col-span-2">
                  {busy ? "Saving…" : "Save profile"}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="receipt">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Receipt</CardTitle>
            <CardDescription>Customize what prints on customer receipts.</CardDescription>
          </CardHeader>
          <CardContent>
            {receipt && (
              <form onSubmit={saveReceipt} className="space-y-4">
                <div className="space-y-2">
                  <Label>Header text</Label>
                  <Input
                    value={receipt.headerText}
                    onChange={(e) => setReceipt({ ...receipt, headerText: e.target.value })}
                    placeholder="e.g. VAT Reg: 1234567"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Footer text</Label>
                  <Input
                    value={receipt.footerText}
                    onChange={(e) => setReceipt({ ...receipt, footerText: e.target.value })}
                  />
                </div>
                <div className="flex gap-6">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={receipt.showLogo}
                      onChange={(e) => setReceipt({ ...receipt, showLogo: e.target.checked })}
                    />
                    Show logo
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={receipt.showCashier}
                      onChange={(e) => setReceipt({ ...receipt, showCashier: e.target.checked })}
                    />
                    Show cashier name
                  </label>
                </div>
                <Button type="submit" disabled={busy}>
                  {busy ? "Saving…" : "Save receipt settings"}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="subscription" className="space-y-4">
        {sub && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                Current plan: {sub.plan}
                <Badge
                  variant="secondary"
                  className={sub.status === "ACTIVE" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}
                >
                  {sub.status}
                </Badge>
              </CardTitle>
              <CardDescription>
                ৳{sub.monthlyPrice}/month · renews {new Date(sub.currentPeriodEnd).toLocaleDateString()}
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm sm:grid-cols-3">
              <div>
                Users:{" "}
                <span className="font-semibold">
                  {sub.usage.users}/{sub.limits.users ?? "∞"}
                </span>
              </div>
              <div>
                Products:{" "}
                <span className="font-semibold">
                  {sub.usage.products}/{sub.limits.products ?? "∞"}
                </span>
              </div>
              <div>
                AI today:{" "}
                <span className="font-semibold">
                  {sub.usage.aiQueriesToday}/{sub.limits.aiQueriesPerDay ?? "∞"}
                </span>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-3 sm:grid-cols-3">
          {PLANS.map((p) => (
            <Card key={p.id} className={sub?.plan === p.id ? "border-primary" : ""}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{p.id}</CardTitle>
                <CardDescription>৳{p.price}/month</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xs text-muted-foreground">{p.blurb}</p>
                <Button
                  variant={sub?.plan === p.id ? "secondary" : "default"}
                  size="sm"
                  className="w-full"
                  disabled={sub?.plan === p.id}
                  onClick={() => changePlan(p.id)}
                >
                  {sub?.plan === p.id ? "Current plan" : "Switch"}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        {invoices.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Billing history</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {invoices.map((inv) => (
                <div key={inv.id} className="flex justify-between border-b pb-2 last:border-0">
                  <span>
                    {inv.plan} <span className="text-muted-foreground">— {inv.note}</span>
                  </span>
                  <span className="font-medium">
                    ৳{Number(inv.amount).toLocaleString()} ·{" "}
                    {new Date(inv.createdAt).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </TabsContent>
    </Tabs>
  );
}
