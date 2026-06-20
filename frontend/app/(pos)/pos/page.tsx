"use client";

import {
  Bike,
  Minus,
  PauseCircle,
  Percent,
  PlayCircle,
  Plus,
  Search,
  Trash2,
  UserRound,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { ItemConfigDialog, type ItemConfig } from "@/components/pos/item-config-dialog";
import { PaymentDialog, type PaymentSubmission } from "@/components/pos/payment-dialog";
import { ReceiptDialog, type CompletedOrder } from "@/components/pos/receipt-dialog";
import { RegisterControls, type Register } from "@/components/pos/register-controls";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Hint } from "@/components/ui/hint";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { api, ApiRequestError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { PLATFORMS } from "@/lib/platforms";
import type {
  Branch,
  InvoiceSettings,
  OrderPlatform,
  PlatformSettings,
  Product,
  ProductDetail,
  SelectedModifier,
  TaxSettings,
} from "@/lib/types";

// Minimal product shape a cart line needs — satisfied by both Product and ProductDetail.
type CartProduct = { id: string; name: string; price: string | number; imageUrl?: string | null };

interface CartLine {
  key: string; // unique per configured line
  product: CartProduct;
  qty: number;
  variationId?: string;
  variationName?: string;
  unitPrice: number; // base price (variation price, or product price)
  modifiers: SelectedModifier[];
  specialNote?: string;
}

const lineUnitTotal = (l: CartLine) =>
  l.unitPrice + l.modifiers.reduce((s, m) => s + m.price * m.quantity, 0);

interface HeldCart {
  id: string;
  heldAt: string;
  lines: CartLine[];
}

const money = (n: string | number) =>
  `৳${Number(n).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

const CARD_COLORS = [
  "bg-rose-500",
  "bg-sky-500",
  "bg-amber-500",
  "bg-emerald-500",
  "bg-violet-500",
  "bg-orange-500",
];

function ProductImage({
  product,
  size,
}: {
  product: { name: string; imageUrl?: string | null };
  size: "lg" | "sm";
}) {
  const cls = size === "lg" ? "h-16 w-full rounded-lg" : "h-9 w-9 rounded-md";
  if (product.imageUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={product.imageUrl} alt="" className={`${cls} border object-cover`} />;
  }
  const color = CARD_COLORS[product.name.length % CARD_COLORS.length];
  return (
    <div
      className={`${cls} flex items-center justify-center font-black text-white ${color} ${size === "lg" ? "text-xl" : "text-[10px]"}`}
    >
      {product.name.slice(0, 2).toUpperCase()}
    </div>
  );
}

export default function PosPage() {
  const { user } = useAuth();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchId, setBranchId] = useState<string>("");
  const [register, setRegister] = useState<Register | null>(null);
  const [products, setProducts] = useState<Product[] | null>(null);
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [held, setHeld] = useState<HeldCart[]>([]);
  const [discountPct, setDiscountPct] = useState("");
  const [discountMode, setDiscountMode] = useState<"pct" | "amt">("pct");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [tax, setTax] = useState<TaxSettings>({ enabled: false, rate: 0, label: "VAT" });
  const [platformCfg, setPlatformCfg] = useState<PlatformSettings | null>(null);
  const [platform, setPlatform] = useState<OrderPlatform>("OTHER");
  const [platformOrderId, setPlatformOrderId] = useState("");
  const [configProduct, setConfigProduct] = useState<ProductDetail | null>(null);
  const [payOpen, setPayOpen] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);
  const [receipt, setReceipt] = useState<CompletedOrder | null>(null);
  const [businessName, setBusinessName] = useState("Smart POS");
  const [invoiceCfg, setInvoiceCfg] = useState<Partial<InvoiceSettings>>({});
  const [businessInfo, setBusinessInfo] = useState<{
    phone?: string | null;
    address?: string | null;
    email?: string | null;
  }>({});
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api
      .get<{ branches: Branch[]; business?: { name: string } }>("/users/me")
      .then((res) => {
        const me = res.data as unknown as { branches: Branch[]; business?: { name: string } };
        setBusinessName(me.business?.name ?? "Smart POS");
        setBranches(me.branches ?? []);
        if ((me.branches ?? []).length > 0) setBranchId(me.branches[0].id);
      })
      .catch(() => toast.error("Failed to load your branches"));
    api
      .get<{ tax: TaxSettings; platforms: PlatformSettings; receipt: InvoiceSettings }>("/settings")
      .then((res) => {
        setTax(res.data.tax);
        setPlatformCfg(res.data.platforms);
        if (res.data.receipt) setInvoiceCfg(res.data.receipt);
      })
      .catch(() => {});
    api
      .get<{ phone?: string | null; address?: string | null; email?: string | null }>("/business")
      .then((res) =>
        setBusinessInfo({
          phone: res.data.phone,
          address: res.data.address,
          email: res.data.email,
        })
      )
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!branchId) return;
    try {
      const raw = localStorage.getItem(`smartpos.held.${branchId}`);
      setHeld(raw ? JSON.parse(raw) : []);
    } catch {
      setHeld([]);
    }
  }, [branchId]);

  const persistHeld = useCallback(
    (next: HeldCart[]) => {
      setHeld(next);
      localStorage.setItem(`smartpos.held.${branchId}`, JSON.stringify(next));
    },
    [branchId]
  );

  useEffect(() => {
    if (!branchId) return;
    api
      .get<Register | null>(`/registers/${branchId}`)
      .then((res) => setRegister(res.data))
      .catch(() => setRegister(null));
  }, [branchId]);

  useEffect(() => {
    const t = setTimeout(() => {
      api
        .get<Product[]>(`/products?limit=100&search=${encodeURIComponent(search)}`)
        .then((res) => setProducts(res.data.filter((p) => p.isActive)))
        .catch(() => toast.error("Failed to load products"));
    }, 250);
    return () => clearTimeout(t);
  }, [search]);

  // Plain add (no variations/modifiers) — merges with an existing identical line.
  const addPlainLine = useCallback((product: CartProduct) => {
    setCart((c) => {
      const existing = c.find(
        (l) => l.product.id === product.id && !l.variationId && l.modifiers.length === 0 && !l.specialNote
      );
      if (existing) {
        return c.map((l) => (l.key === existing.key ? { ...l, qty: l.qty + 1 } : l));
      }
      return [
        ...c,
        {
          key: crypto.randomUUID(),
          product,
          qty: 1,
          unitPrice: Number(product.price),
          modifiers: [],
        },
      ];
    });
  }, []);

  const needsConfig = (p: { hasVariations?: boolean; modifierGroups?: unknown[] }) =>
    Boolean(p.hasVariations) || (p.modifierGroups?.length ?? 0) > 0;

  // Product tile click: open the config dialog when the item has options, else add directly.
  const onProductClick = useCallback(
    async (product: Product) => {
      if (!needsConfig(product)) {
        addPlainLine(product);
        return;
      }
      try {
        const res = await api.get<ProductDetail>(`/products/${product.id}`);
        setConfigProduct(res.data);
      } catch {
        toast.error("Failed to load product options");
      }
    },
    [addPlainLine]
  );

  function addConfiguredLine(product: ProductDetail, config: ItemConfig) {
    setCart((c) => [
      ...c,
      {
        key: crypto.randomUUID(),
        product,
        qty: config.qty,
        variationId: config.variationId,
        variationName: config.variationName,
        unitPrice: config.unitPrice,
        modifiers: config.modifiers,
        specialNote: config.specialNote,
      },
    ]);
    setConfigProduct(null);
  }

  const setQty = (key: string, qty: number) => {
    setCart((c) =>
      qty <= 0 ? c.filter((l) => l.key !== key) : c.map((l) => (l.key === key ? { ...l, qty } : l))
    );
  };

  async function onSearchEnter() {
    const code = search.trim();
    if (!/^\d{6,}$/.test(code)) return;
    try {
      const res = await api.get<ProductDetail>(`/products/barcode/${encodeURIComponent(code)}`);
      if (needsConfig(res.data)) {
        setConfigProduct(res.data);
      } else {
        addPlainLine(res.data);
        toast.success(`Added ${res.data.name}`);
      }
      setSearch("");
    } catch {
      toast.error("No product found for this barcode");
    }
  }

  const itemCount = useMemo(() => cart.reduce((s, l) => s + l.qty, 0), [cart]);
  const subtotal = useMemo(
    () => cart.reduce((sum, l) => sum + lineUnitTotal(l) * l.qty, 0),
    [cart]
  );
  const discountAmount = useMemo(() => {
    const v = Number(discountPct) || 0;
    const amt = discountMode === "pct" ? (subtotal * Math.min(v, 100)) / 100 : Math.min(v, subtotal);
    return Number(amt.toFixed(2));
  }, [discountPct, discountMode, subtotal]);
  const taxAmount = useMemo(() => {
    if (!tax.enabled || tax.rate <= 0) return 0;
    return Number((((subtotal - discountAmount) * tax.rate) / 100).toFixed(2));
  }, [tax, subtotal, discountAmount]);
  const total = Number((subtotal - discountAmount + taxAmount).toFixed(2));

  // Only In-store + the platforms enabled in settings.
  const availablePlatforms = PLATFORMS.filter(
    (p) => !p.settingsKey || platformCfg?.[p.settingsKey]?.enabled
  );

  function choosePlatform(p: OrderPlatform) {
    setPlatform(p);
    setPlatformOrderId("");
    // Auto-apply the platform's configured discount (clears it for In-store).
    const meta = PLATFORMS.find((x) => x.id === p);
    const cfg = meta?.settingsKey && platformCfg ? platformCfg[meta.settingsKey] : null;
    if (cfg && cfg.discountPercent > 0) {
      setDiscountMode("pct");
      setDiscountPct(String(cfg.discountPercent));
    } else {
      setDiscountPct("");
    }
  }

  function clearSale() {
    if (cart.length === 0) return;
    if (!confirm("Cancel this sale? The cart will be emptied.")) return;
    setCart([]);
    setDiscountPct("");
    setCustomerName("");
    setCustomerPhone("");
    setPlatform("OTHER");
    setPlatformOrderId("");
    toast.info("Sale cancelled");
  }

  function holdCart() {
    if (cart.length === 0) return;
    persistHeld([
      ...held,
      { id: crypto.randomUUID(), heldAt: new Date().toISOString(), lines: cart },
    ]);
    setCart([]);
    setDiscountPct("");
    toast.success("Sale held — resume it anytime");
  }

  function resumeCart(h: HeldCart) {
    if (cart.length > 0) {
      toast.error("Finish or hold the current sale first");
      return;
    }
    // Normalize older held carts that predate configured lines.
    setCart(
      h.lines.map((l) => ({
        ...l,
        key: l.key ?? crypto.randomUUID(),
        modifiers: l.modifiers ?? [],
        unitPrice: l.unitPrice ?? Number(l.product.price),
      }))
    );
    persistHeld(held.filter((x) => x.id !== h.id));
  }

  async function completeSale(payments: PaymentSubmission[]) {
    setCheckingOut(true);
    try {
      const res = await api.post<CompletedOrder>("/orders", {
        branchId,
        registerId: register?.id,
        items: cart.map((l) => ({
          productId: l.product.id,
          quantity: l.qty,
          ...(l.variationId ? { variationId: l.variationId } : {}),
          ...(l.modifiers.length
            ? { modifiers: l.modifiers.map((m) => ({ modifierItemId: m.modifierItemId, quantity: m.quantity })) }
            : {}),
          ...(l.specialNote ? { specialNote: l.specialNote } : {}),
        })),
        payments,
        ...(discountAmount > 0 ? { discountAmount } : {}),
        ...(taxAmount > 0 ? { taxAmount } : {}),
        ...(customerName.trim() ? { customerName: customerName.trim() } : {}),
        ...(customerPhone.trim() ? { customerPhone: customerPhone.trim() } : {}),
        ...(platform !== "OTHER" ? { platform } : {}),
        ...(platformOrderId.trim() ? { platformOrderId: platformOrderId.trim() } : {}),
      });
      setPayOpen(false);
      setReceipt(res.data);
      setCart([]);
      setDiscountPct("");
      setCustomerName("");
      setCustomerPhone("");
      setPlatform("OTHER");
      setPlatformOrderId("");
    } catch (e) {
      toast.error(e instanceof ApiRequestError ? e.message : "Checkout failed");
    } finally {
      setCheckingOut(false);
    }
  }

  if (!user) return null;

  return (
    <div className="flex h-full">
      {/* ── Left: products ───────────────────────────── */}
      <div className="flex min-w-0 flex-1 flex-col border-r">
        <div className="flex flex-wrap items-center gap-2 border-b p-3">
          <div className="relative min-w-48 flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              ref={searchRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && onSearchEnter()}
              placeholder="Search name, SKU, or scan barcode…"
              className="pl-8"
              autoFocus
            />
          </div>
          {branches.length > 1 && (
            <Select value={branchId} onValueChange={setBranchId}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Branch" />
              </SelectTrigger>
              <SelectContent>
                {branches.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {branchId && (
            <RegisterControls branchId={branchId} register={register} onChange={setRegister} />
          )}
        </div>

        <div className="grid flex-1 auto-rows-min grid-cols-2 gap-3 overflow-y-auto p-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {products === null &&
            Array.from({ length: 10 }).map((_, i) => <Skeleton key={i} className="h-32" />)}
          {products?.length === 0 && (
            <p className="col-span-full py-10 text-center text-sm text-muted-foreground">
              No products found.
            </p>
          )}
          {products?.map((p) => (
            <button
              key={p.id}
              onClick={() => onProductClick(p)}
              className="rounded-xl border bg-card p-2.5 text-left transition-all hover:border-primary hover:shadow-sm active:scale-95"
            >
              <ProductImage product={p} size="lg" />
              <div className="mt-2 line-clamp-2 text-sm font-medium leading-tight">{p.name}</div>
              <div className="mt-1 flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  {needsConfig(p) ? "Options" : p.sku}
                </span>
                <span className="font-bold text-primary">
                  {needsConfig(p) ? `from ${money(p.price)}` : money(p.price)}
                </span>
              </div>
            </button>
          ))}
        </div>

        {held.length > 0 && (
          <div className="flex items-center gap-2 overflow-x-auto border-t p-2">
            <span className="shrink-0 text-xs font-medium text-muted-foreground">Held:</span>
            {held.map((h) => (
              <Button key={h.id} variant="outline" size="sm" onClick={() => resumeCart(h)}>
                <PlayCircle className="mr-1 h-3.5 w-3.5" />
                {h.lines.reduce((s, l) => s + l.qty, 0)} items ·{" "}
                {new Date(h.heldAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </Button>
            ))}
          </div>
        )}
      </div>

      {/* ── Right: cart ──────────────────────────────── */}
      <div className="flex w-80 shrink-0 flex-col lg:w-[26rem]">
        <div className="flex items-center justify-between border-b p-3">
          <h2 className="flex items-center gap-2 font-semibold">
            Current sale
            {itemCount > 0 && (
              <Badge className="rounded-full" variant="default">
                {itemCount} item{itemCount === 1 ? "" : "s"}
              </Badge>
            )}
          </h2>
          <div className="flex gap-1">
            <Button variant="ghost" size="sm" onClick={holdCart} disabled={cart.length === 0}>
              <PauseCircle className="mr-1 h-4 w-4" /> Hold
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-red-600"
              onClick={clearSale}
              disabled={cart.length === 0}
            >
              <XCircle className="mr-1 h-4 w-4" /> Cancel
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          {cart.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              Tap products to add them to the sale.
            </p>
          ) : (
            <div className="space-y-2">
              {cart.map((l) => (
                <div key={l.key} className="flex items-start gap-2 rounded-xl border bg-card p-2">
                  <ProductImage product={l.product} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">
                      {l.product.name}
                      {l.variationName ? (
                        <span className="text-muted-foreground"> — {l.variationName}</span>
                      ) : null}
                    </div>
                    <div className="text-xs text-muted-foreground">{money(lineUnitTotal(l))} each</div>
                    {l.modifiers.length > 0 && (
                      <div className="mt-0.5 text-[11px] leading-tight text-muted-foreground">
                        {l.modifiers
                          .map((m) => `${m.name}${m.quantity > 1 ? ` ×${m.quantity}` : ""}`)
                          .join(", ")}
                      </div>
                    )}
                    {l.specialNote && (
                      <div className="mt-0.5 text-[11px] italic leading-tight text-amber-600">
                        “{l.specialNote}”
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => setQty(l.key, l.qty - 1)}
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="w-7 text-center text-sm font-bold">{l.qty}</span>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => setQty(l.key, l.qty + 1)}
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                      <Hint label="Remove item">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-red-500"
                          onClick={() => setQty(l.key, 0)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </Hint>
                    </div>
                    <div className="text-sm font-semibold">{money(lineUnitTotal(l) * l.qty)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-2.5 border-t p-3">
          {/* Platform / sales channel */}
          <div className="flex items-center gap-2">
            <Bike className="h-4 w-4 shrink-0 text-muted-foreground" />
            <Select value={platform} onValueChange={(v) => choosePlatform(v as OrderPlatform)}>
              <SelectTrigger className="h-8 flex-1 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {availablePlatforms.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {platform !== "OTHER" && (
              <Input
                value={platformOrderId}
                onChange={(e) => setPlatformOrderId(e.target.value)}
                placeholder="Platform order ID"
                className="h-8 w-36 text-sm"
              />
            )}
          </div>

          {/* Customer (optional) */}
          <div className="flex items-center gap-2">
            <UserRound className="h-4 w-4 shrink-0 text-muted-foreground" />
            <Input
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Customer name (optional)"
              className="h-8 text-sm"
            />
            <Input
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              placeholder="Mobile no."
              className="h-8 w-32 text-sm"
            />
          </div>

          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Subtotal ({itemCount} items)</span>
            <span>{money(subtotal)}</span>
          </div>

          {/* Discount with % / ৳ toggle */}
          <div className="flex items-center justify-between gap-2 text-sm">
            <span className="text-muted-foreground">Discount</span>
            <div className="flex items-center gap-1.5">
              <div className="flex overflow-hidden rounded-md border">
                <button
                  type="button"
                  onClick={() => setDiscountMode("pct")}
                  className={`px-2 py-1 text-xs font-bold ${discountMode === "pct" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
                >
                  <Percent className="h-3 w-3" />
                </button>
                <button
                  type="button"
                  onClick={() => setDiscountMode("amt")}
                  className={`px-2 py-1 text-xs font-bold ${discountMode === "amt" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
                >
                  ৳
                </button>
              </div>
              <Input
                type="number"
                min="0"
                max={discountMode === "pct" ? 100 : subtotal}
                value={discountPct}
                onChange={(e) => setDiscountPct(e.target.value)}
                className="h-8 w-20 text-right"
                placeholder="0"
              />
              {discountAmount > 0 && (
                <span className="text-xs text-red-600">-{money(discountAmount)}</span>
              )}
            </div>
          </div>

          {tax.enabled && tax.rate > 0 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {tax.label} ({tax.rate}%)
              </span>
              <span>{money(taxAmount)}</span>
            </div>
          )}

          <div className="flex items-center justify-between text-lg font-bold">
            <span>Total</span>
            <span>{money(total)}</span>
          </div>

          <Button
            className="h-12 w-full text-base"
            disabled={cart.length === 0 || !branchId}
            onClick={() => setPayOpen(true)}
          >
            Charge {money(total)}
          </Button>
        </div>
      </div>

      <ItemConfigDialog
        product={configProduct}
        onClose={() => setConfigProduct(null)}
        onAdd={(config) => configProduct && addConfiguredLine(configProduct, config)}
      />

      <PaymentDialog
        open={payOpen}
        total={total}
        busy={checkingOut}
        onClose={() => setPayOpen(false)}
        onComplete={completeSale}
      />

      <ReceiptDialog
        order={receipt}
        businessName={businessName}
        invoice={invoiceCfg}
        business={businessInfo}
        onClose={() => {
          setReceipt(null);
          searchRef.current?.focus();
        }}
      />
    </div>
  );
}
