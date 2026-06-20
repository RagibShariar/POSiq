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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api, ApiRequestError } from "@/lib/api";
import { BARCODE_TYPES, DEFAULT_BARCODE_SETTINGS, SHEET_PRESETS } from "@/lib/barcode";
import type { BarcodeSettings, InvoiceSettings, PlatformSettings } from "@/lib/types";

const PLATFORM_ROWS: { key: keyof PlatformSettings; label: string }[] = [
  { key: "foodpanda", label: "Foodpanda" },
  { key: "pathao", label: "Pathao food" },
  { key: "foodi", label: "Foodi" },
];

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

interface TaxSettings {
  enabled: boolean;
  rate: number;
  label: string;
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
  const [receipt, setReceipt] = useState<InvoiceSettings | null>(null);
  const [tax, setTax] = useState<TaxSettings | null>(null);
  const [platforms, setPlatforms] = useState<PlatformSettings | null>(null);
  const [barcode, setBarcode] = useState<BarcodeSettings | null>(null);
  const [sub, setSub] = useState<Subscription | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get<BusinessProfile>("/business").then((r) => setProfile(r.data)).catch(() => {});
    api
      .get<{ tax: TaxSettings; platforms: PlatformSettings; receipt: InvoiceSettings; barcode: BarcodeSettings }>(
        "/settings"
      )
      .then((r) => {
        setTax(r.data.tax);
        setPlatforms(r.data.platforms);
        setReceipt(r.data.receipt);
        setBarcode({ ...DEFAULT_BARCODE_SETTINGS, ...r.data.barcode });
      })
      .catch(() => {});
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

  async function saveTax(e: React.FormEvent) {
    e.preventDefault();
    if (!tax) return;
    setBusy(true);
    try {
      await api.patch("/settings", { tax: { ...tax, rate: Number(tax.rate) || 0 } });
      toast.success("Tax settings saved");
    } catch (err) {
      toast.error(err instanceof ApiRequestError ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  function setPlat(key: keyof PlatformSettings, patch: Partial<PlatformSettings[keyof PlatformSettings]>) {
    setPlatforms((p) => (p ? { ...p, [key]: { ...p[key], ...patch } } : p));
  }

  async function savePlatforms(e: React.FormEvent) {
    e.preventDefault();
    if (!platforms) return;
    setBusy(true);
    try {
      await api.patch("/settings", { platforms });
      toast.success("Platform settings saved");
    } catch (err) {
      toast.error(err instanceof ApiRequestError ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function saveBarcode(e: React.FormEvent) {
    e.preventDefault();
    if (!barcode) return;
    setBusy(true);
    try {
      await api.patch("/settings", { barcode });
      toast.success("Barcode settings saved");
    } catch (err) {
      toast.error(err instanceof ApiRequestError ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  function setBc(patch: Partial<BarcodeSettings>) {
    setBarcode((b) => (b ? { ...b, ...patch } : b));
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
        <TabsTrigger value="receipt">Invoice</TabsTrigger>
        <TabsTrigger value="barcode">Barcode</TabsTrigger>
        <TabsTrigger value="platforms">Platforms</TabsTrigger>
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

      <TabsContent value="receipt" className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tax / VAT</CardTitle>
            <CardDescription>
              Applied automatically at the POS on the amount after discount.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {tax && (
              <form onSubmit={saveTax} className="flex flex-wrap items-end gap-4">
                <label className="flex items-center gap-2 pb-2 text-sm">
                  <input
                    type="checkbox"
                    checked={tax.enabled}
                    onChange={(e) => setTax({ ...tax, enabled: e.target.checked })}
                  />
                  Charge tax
                </label>
                <div className="space-y-2">
                  <Label>Label</Label>
                  <Input
                    value={tax.label}
                    onChange={(e) => setTax({ ...tax, label: e.target.value })}
                    className="w-28"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Rate (%)</Label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    step="0.5"
                    value={tax.rate}
                    onChange={(e) => setTax({ ...tax, rate: Number(e.target.value) })}
                    className="w-24"
                  />
                </div>
                <Button type="submit" disabled={busy}>
                  {busy ? "Saving…" : "Save tax"}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Invoice / receipt</CardTitle>
            <CardDescription>Customize what prints on the customer invoice.</CardDescription>
          </CardHeader>
          <CardContent>
            {receipt && (
              <form onSubmit={saveReceipt} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Paper size</Label>
                    <Select
                      value={receipt.paperSize}
                      onValueChange={(v) =>
                        setReceipt({ ...receipt, paperSize: v as InvoiceSettings["paperSize"] })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="80mm">80mm thermal</SelectItem>
                        <SelectItem value="58mm">58mm thermal</SelectItem>
                        <SelectItem value="A4">A4 sheet</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Accent color</Label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={receipt.accentColor}
                        onChange={(e) => setReceipt({ ...receipt, accentColor: e.target.value })}
                        className="h-9 w-14 rounded border"
                      />
                      <Input
                        value={receipt.accentColor}
                        onChange={(e) => setReceipt({ ...receipt, accentColor: e.target.value })}
                        className="w-28"
                      />
                    </div>
                  </div>
                </div>
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
                <div className="space-y-2">
                  <Label>Font scale ({receipt.fontScale}%)</Label>
                  <input
                    type="range"
                    min={80}
                    max={130}
                    step={5}
                    value={receipt.fontScale}
                    onChange={(e) => setReceipt({ ...receipt, fontScale: Number(e.target.value) })}
                    className="w-full"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {(
                    [
                      ["showLogo", "Show logo"],
                      ["showCashier", "Cashier name"],
                      ["showPhone", "Business phone"],
                      ["showAddress", "Business address"],
                      ["showEmail", "Business email"],
                      ["showCustomer", "Customer details"],
                      ["showTaxBreakdown", "Tax breakdown"],
                      ["showOrderNote", "Order note"],
                    ] as const
                  ).map(([key, label]) => (
                    <label key={key} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={receipt[key]}
                        onChange={(e) => setReceipt({ ...receipt, [key]: e.target.checked })}
                      />
                      {label}
                    </label>
                  ))}
                </div>
                <Button type="submit" disabled={busy}>
                  {busy ? "Saving…" : "Save invoice settings"}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="barcode">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Barcode labels</CardTitle>
            <CardDescription>
              Defaults for the{" "}
              <a href="/labels" className="font-medium underline">
                Print Labels
              </a>{" "}
              page — which fields appear on each sticker and how big they are.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {barcode && (
              <form onSubmit={saveBarcode} className="space-y-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Barcode type</Label>
                    <Select
                      value={barcode.barcodeType}
                      onValueChange={(v) =>
                        setBc({ barcodeType: v as BarcodeSettings["barcodeType"] })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {BARCODE_TYPES.map((b) => (
                          <SelectItem key={b.id} value={b.id}>
                            {b.label} — {b.hint}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Default label sheet</Label>
                    <Select value={barcode.sheet} onValueChange={(v) => setBc({ sheet: v })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SHEET_PRESETS.map((s) => (
                          <SelectItem key={s.key} value={s.key}>
                            {s.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  {(
                    [
                      ["showProductName", "productNameSize", "Product name"],
                      ["showVariation", "variationSize", "Variation"],
                      ["showPrice", "priceSize", "Price"],
                      ["showBusinessName", "businessNameSize", "Business name"],
                      ["showPackingDate", "packingDateSize", "Packing date"],
                      ["showSku", "skuSize", "SKU text"],
                    ] as const
                  ).map(([showKey, sizeKey, label]) => (
                    <div key={showKey} className="flex items-center justify-between rounded-lg border p-3">
                      <label className="flex items-center gap-2 text-sm font-medium">
                        <input
                          type="checkbox"
                          checked={barcode[showKey]}
                          onChange={(e) => setBc({ [showKey]: e.target.checked })}
                        />
                        {label}
                      </label>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">Size</span>
                        <Input
                          type="number"
                          min={6}
                          max={40}
                          value={barcode[sizeKey]}
                          disabled={!barcode[showKey]}
                          onChange={(e) => setBc({ [sizeKey]: Number(e.target.value) || 10 })}
                          className="h-8 w-16"
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={barcode.priceTaxMode === "inc"}
                    onChange={(e) => setBc({ priceTaxMode: e.target.checked ? "inc" : "exc" })}
                  />
                  Show price including tax
                </label>

                <Button type="submit" disabled={busy}>
                  {busy ? "Saving…" : "Save barcode defaults"}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="platforms">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Platform management</CardTitle>
            <CardDescription>
              Delivery channels available at the POS. A platform&apos;s discount is auto-applied when
              the cashier selects it. In-store sales always use no platform.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {platforms && (
              <form onSubmit={savePlatforms} className="space-y-3">
                {PLATFORM_ROWS.map(({ key, label }) => {
                  const cfg = platforms[key];
                  return (
                    <div key={key} className="rounded-lg border p-3">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <label className="flex items-center gap-2 text-sm font-semibold">
                          <input
                            type="checkbox"
                            checked={cfg.enabled}
                            onChange={(e) => setPlat(key, { enabled: e.target.checked })}
                          />
                          {label}
                        </label>
                        <div className="flex overflow-hidden rounded-md border text-xs font-semibold">
                          {(["PAY_NOW", "PAY_LATER"] as const).map((m) => (
                            <button
                              key={m}
                              type="button"
                              onClick={() => setPlat(key, { paymentMethod: m })}
                              className={`px-3 py-1.5 ${
                                cfg.paymentMethod === m
                                  ? "bg-primary text-primary-foreground"
                                  : "bg-muted text-muted-foreground"
                              }`}
                            >
                              {m === "PAY_NOW" ? "Pay now" : "Pay later"}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="mt-3 flex items-center gap-2">
                        <Label className="text-xs text-muted-foreground">Auto discount</Label>
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          step="0.5"
                          value={cfg.discountPercent}
                          onChange={(e) =>
                            setPlat(key, { discountPercent: Number(e.target.value) || 0 })
                          }
                          className="h-8 w-24"
                        />
                        <span className="text-xs text-muted-foreground">%</span>
                      </div>
                    </div>
                  );
                })}
                <p className="text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">In-store</span> is always available
                  with no platform discount.
                </p>
                <Button type="submit" disabled={busy}>
                  {busy ? "Saving…" : "Save platforms"}
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
