"use client";

import {
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
import { PaymentDialog, type PaymentSubmission } from "@/components/pos/payment-dialog";
import { ReceiptDialog, type CompletedOrder } from "@/components/pos/receipt-dialog";
import { RegisterControls, type Register } from "@/components/pos/register-controls";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import type { Branch, Product, TaxSettings } from "@/lib/types";

interface CartLine {
  product: Product;
  qty: number;
}

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

function ProductImage({ product, size }: { product: Product; size: "lg" | "sm" }) {
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
  const [payOpen, setPayOpen] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);
  const [receipt, setReceipt] = useState<CompletedOrder | null>(null);
  const [businessName, setBusinessName] = useState("Smart POS");
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
      .get<{ tax: TaxSettings }>("/settings")
      .then((res) => setTax(res.data.tax))
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

  const addToCart = useCallback((product: Product) => {
    setCart((c) => {
      const existing = c.find((l) => l.product.id === product.id);
      if (existing) {
        return c.map((l) => (l.product.id === product.id ? { ...l, qty: l.qty + 1 } : l));
      }
      return [...c, { product, qty: 1 }];
    });
  }, []);

  const setQty = (productId: string, qty: number) => {
    setCart((c) =>
      qty <= 0
        ? c.filter((l) => l.product.id !== productId)
        : c.map((l) => (l.product.id === productId ? { ...l, qty } : l))
    );
  };

  async function onSearchEnter() {
    const code = search.trim();
    if (!/^\d{6,}$/.test(code)) return;
    try {
      const res = await api.get<Product>(`/products/barcode/${encodeURIComponent(code)}`);
      addToCart(res.data);
      setSearch("");
      toast.success(`Added ${res.data.name}`);
    } catch {
      toast.error("No product found for this barcode");
    }
  }

  const itemCount = useMemo(() => cart.reduce((s, l) => s + l.qty, 0), [cart]);
  const subtotal = useMemo(
    () => cart.reduce((sum, l) => sum + Number(l.product.price) * l.qty, 0),
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

  function clearSale() {
    if (cart.length === 0) return;
    if (!confirm("Cancel this sale? The cart will be emptied.")) return;
    setCart([]);
    setDiscountPct("");
    setCustomerName("");
    setCustomerPhone("");
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
    setCart(h.lines);
    persistHeld(held.filter((x) => x.id !== h.id));
  }

  async function completeSale(payments: PaymentSubmission[]) {
    setCheckingOut(true);
    try {
      const res = await api.post<CompletedOrder>("/orders", {
        branchId,
        registerId: register?.id,
        items: cart.map((l) => ({ productId: l.product.id, quantity: l.qty })),
        payments,
        ...(discountAmount > 0 ? { discountAmount } : {}),
        ...(taxAmount > 0 ? { taxAmount } : {}),
        ...(customerName.trim() ? { customerName: customerName.trim() } : {}),
        ...(customerPhone.trim() ? { customerPhone: customerPhone.trim() } : {}),
      });
      setPayOpen(false);
      setReceipt(res.data);
      setCart([]);
      setDiscountPct("");
      setCustomerName("");
      setCustomerPhone("");
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
              onClick={() => addToCart(p)}
              className="rounded-xl border bg-card p-2.5 text-left transition-all hover:border-primary hover:shadow-sm active:scale-95"
            >
              <ProductImage product={p} size="lg" />
              <div className="mt-2 line-clamp-2 text-sm font-medium leading-tight">{p.name}</div>
              <div className="mt-1 flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{p.sku}</span>
                <span className="font-bold text-primary">{money(p.price)}</span>
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
                <div key={l.product.id} className="flex items-center gap-2 rounded-xl border bg-card p-2">
                  <ProductImage product={l.product} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{l.product.name}</div>
                    <div className="text-xs text-muted-foreground">{money(l.product.price)} each</div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => setQty(l.product.id, l.qty - 1)}
                    >
                      <Minus className="h-3 w-3" />
                    </Button>
                    <span className="w-7 text-center text-sm font-bold">{l.qty}</span>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => setQty(l.product.id, l.qty + 1)}
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                  <div className="w-16 text-right text-sm font-semibold">
                    {money(Number(l.product.price) * l.qty)}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-red-500"
                    onClick={() => setQty(l.product.id, 0)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-2.5 border-t p-3">
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
        onClose={() => {
          setReceipt(null);
          searchRef.current?.focus();
        }}
      />
    </div>
  );
}
