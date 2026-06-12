"use client";

import {
  Banknote,
  CreditCard,
  Minus,
  PauseCircle,
  PlayCircle,
  Plus,
  Search,
  Smartphone,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { ReceiptDialog, type CompletedOrder } from "@/components/pos/receipt-dialog";
import { RegisterControls, type Register } from "@/components/pos/register-controls";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
import type { Branch, Product } from "@/lib/types";

interface CartLine {
  product: Product;
  qty: number;
}

interface HeldCart {
  id: string;
  heldAt: string;
  lines: CartLine[];
}

const PAYMENT_METHODS = [
  { value: "CASH", label: "Cash", icon: Banknote },
  { value: "CARD", label: "Card", icon: CreditCard },
  { value: "MOBILE_BANKING", label: "Mobile", icon: Smartphone },
] as const;

const money = (n: string | number) => `৳${Number(n).toLocaleString()}`;

export default function PosPage() {
  const { user } = useAuth();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchId, setBranchId] = useState<string>("");
  const [register, setRegister] = useState<Register | null>(null);
  const [products, setProducts] = useState<Product[] | null>(null);
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [held, setHeld] = useState<HeldCart[]>([]);
  const [payment, setPayment] = useState<string>("CASH");
  const [discount, setDiscount] = useState("");
  const [checkingOut, setCheckingOut] = useState(false);
  const [receipt, setReceipt] = useState<CompletedOrder | null>(null);
  const [businessName, setBusinessName] = useState("Smart POS");
  const searchRef = useRef<HTMLInputElement>(null);

  // Branches the user can sell from
  useEffect(() => {
    api
      .get<{ branches?: Branch[] } & { business?: { name: string } } & { id: string }>(
        "/users/me"
      )
      .then((res) => {
        const me = res.data as unknown as {
          branches: Branch[];
          business?: { name: string };
        };
        setBusinessName(me.business?.name ?? "Smart POS");
        const list = me.branches ?? [];
        setBranches(list);
        if (list.length > 0) setBranchId(list[0].id);
      })
      .catch(() => toast.error("Failed to load your branches"));
  }, []);

  // Held carts are per-branch, persisted locally
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

  // Open register lookup per branch
  useEffect(() => {
    if (!branchId) return;
    api
      .get<Register | null>(`/registers/${branchId}`)
      .then((res) => setRegister(res.data))
      .catch(() => setRegister(null));
  }, [branchId]);

  // Product list (debounced search)
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

  // Barcode scanners "type" the code then send Enter
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

  const subtotal = useMemo(
    () => cart.reduce((sum, l) => sum + Number(l.product.price) * l.qty, 0),
    [cart]
  );
  const discountNum = Math.min(Number(discount) || 0, subtotal);
  const total = subtotal - discountNum;

  function holdCart() {
    if (cart.length === 0) return;
    persistHeld([
      ...held,
      { id: crypto.randomUUID(), heldAt: new Date().toISOString(), lines: cart },
    ]);
    setCart([]);
    setDiscount("");
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

  async function checkout() {
    if (!branchId || cart.length === 0) return;
    setCheckingOut(true);
    try {
      const res = await api.post<CompletedOrder>("/orders", {
        branchId,
        registerId: register?.id,
        items: cart.map((l) => ({ productId: l.product.id, quantity: l.qty })),
        paymentMethod: payment,
        ...(discountNum > 0 ? { discountAmount: discountNum } : {}),
      });
      setReceipt(res.data);
      setCart([]);
      setDiscount("");
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
            Array.from({ length: 10 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
          {products?.length === 0 && (
            <p className="col-span-full py-10 text-center text-sm text-muted-foreground">
              No products found.
            </p>
          )}
          {products?.map((p) => (
            <button
              key={p.id}
              onClick={() => addToCart(p)}
              className="rounded-lg border bg-card p-3 text-left transition-colors hover:border-primary hover:bg-accent"
            >
              <div className="line-clamp-2 text-sm font-medium">{p.name}</div>
              <div className="mt-1 text-xs text-muted-foreground">{p.sku}</div>
              <div className="mt-2 font-semibold">{money(p.price)}</div>
            </button>
          ))}
        </div>

        {held.length > 0 && (
          <div className="flex items-center gap-2 border-t p-2">
            <span className="text-xs font-medium text-muted-foreground">Held sales:</span>
            {held.map((h) => (
              <Button key={h.id} variant="outline" size="sm" onClick={() => resumeCart(h)}>
                <PlayCircle className="mr-1 h-3.5 w-3.5" />
                {h.lines.length} item{h.lines.length === 1 ? "" : "s"} ·{" "}
                {new Date(h.heldAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </Button>
            ))}
          </div>
        )}
      </div>

      {/* ── Right: cart ──────────────────────────────── */}
      <div className="flex w-80 shrink-0 flex-col lg:w-96">
        <div className="flex items-center justify-between border-b p-3">
          <h2 className="font-semibold">Current sale</h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={holdCart}
            disabled={cart.length === 0}
            title="Hold this sale"
          >
            <PauseCircle className="mr-1 h-4 w-4" /> Hold
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          {cart.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              Tap products to add them to the sale.
            </p>
          ) : (
            <div className="space-y-2">
              {cart.map((l) => (
                <Card key={l.product.id} className="flex flex-row items-center gap-2 p-2.5">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{l.product.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {money(l.product.price)} each
                    </div>
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
                    <span className="w-7 text-center text-sm font-medium">{l.qty}</span>
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
                    className="h-7 w-7 text-muted-foreground"
                    onClick={() => setQty(l.product.id, 0)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </Card>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-3 border-t p-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Subtotal</span>
            <span>{money(subtotal)}</span>
          </div>
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="text-muted-foreground">Discount (৳)</span>
            <Input
              type="number"
              min="0"
              value={discount}
              onChange={(e) => setDiscount(e.target.value)}
              className="h-8 w-24 text-right"
              placeholder="0"
            />
          </div>
          <div className="flex items-center justify-between text-lg font-bold">
            <span>Total</span>
            <span>{money(total)}</span>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {PAYMENT_METHODS.map((m) => (
              <button
                key={m.value}
                onClick={() => setPayment(m.value)}
                className={`flex flex-col items-center gap-1 rounded-md border p-2 text-xs font-medium transition-colors ${
                  payment === m.value
                    ? "border-primary bg-primary text-primary-foreground"
                    : "hover:bg-accent"
                }`}
              >
                <m.icon className="h-4 w-4" />
                {m.label}
              </button>
            ))}
          </div>

          <Button
            className="h-12 w-full text-base"
            disabled={cart.length === 0 || checkingOut || !branchId}
            onClick={checkout}
          >
            {checkingOut ? "Processing…" : `Charge ${money(total)}`}
          </Button>
        </div>
      </div>

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
