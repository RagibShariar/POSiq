"use client";

import { PackagePlus, Search, SlidersHorizontal } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
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
import { api, ApiRequestError } from "@/lib/api";
import type { Branch, Product } from "@/lib/types";

interface InventoryItem {
  id: string;
  stock: number;
  updatedAt: string;
  product: {
    id: string;
    name: string;
    sku: string;
    unit: string;
    lowStockThreshold: number;
    price: string | number;
  };
}

export default function InventoryPage() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchId, setBranchId] = useState("");
  const [items, setItems] = useState<InventoryItem[] | null>(null);
  const [search, setSearch] = useState("");
  const [lowOnly, setLowOnly] = useState(false);

  // Restock dialog
  const [restockOpen, setRestockOpen] = useState(false);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [restockProductId, setRestockProductId] = useState("");
  const [restockQty, setRestockQty] = useState("");
  const [restockNote, setRestockNote] = useState("");

  // Adjust dialog
  const [adjustItem, setAdjustItem] = useState<InventoryItem | null>(null);
  const [adjustDelta, setAdjustDelta] = useState("");
  const [adjustNote, setAdjustNote] = useState("");

  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api
      .get<Branch[]>("/branches?limit=100")
      .then((res) => {
        setBranches(res.data);
        if (res.data.length > 0) setBranchId(res.data[0].id);
      })
      .catch(() => toast.error("Failed to load branches"));
  }, []);

  const loadInventory = useCallback(() => {
    if (!branchId) return;
    api
      .get<InventoryItem[]>(
        `/inventory/${branchId}?limit=100&search=${encodeURIComponent(search)}`
      )
      .then((res) => setItems(res.data))
      .catch(() => toast.error("Failed to load inventory"));
  }, [branchId, search]);

  useEffect(() => {
    const t = setTimeout(loadInventory, 250);
    return () => clearTimeout(t);
  }, [loadInventory]);

  function openRestock() {
    api
      .get<Product[]>("/products?limit=100")
      .then((res) => setAllProducts(res.data.filter((p) => p.isActive)))
      .catch(() => {});
    setRestockProductId("");
    setRestockQty("");
    setRestockNote("");
    setRestockOpen(true);
  }

  async function submitRestock(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post(`/inventory/${branchId}/restock`, {
        items: [
          {
            productId: restockProductId,
            quantity: Number(restockQty),
            ...(restockNote ? { note: restockNote } : {}),
          },
        ],
      });
      toast.success("Stock added");
      setRestockOpen(false);
      loadInventory();
    } catch (err) {
      toast.error(err instanceof ApiRequestError ? err.message : "Restock failed");
    } finally {
      setBusy(false);
    }
  }

  async function submitAdjust(e: React.FormEvent) {
    e.preventDefault();
    if (!adjustItem) return;
    setBusy(true);
    try {
      await api.patch(`/inventory/${branchId}/${adjustItem.product.id}`, {
        quantity: Number(adjustDelta),
        ...(adjustNote ? { note: adjustNote } : {}),
      });
      toast.success("Stock adjusted");
      setAdjustItem(null);
      loadInventory();
    } catch (err) {
      toast.error(err instanceof ApiRequestError ? err.message : "Adjustment failed");
    } finally {
      setBusy(false);
    }
  }

  const visible = items?.filter(
    (i) => !lowOnly || i.stock < i.product.lowStockThreshold
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={branchId} onValueChange={setBranchId}>
          <SelectTrigger className="w-52">
            <SelectValue placeholder="Select branch" />
          </SelectTrigger>
          <SelectContent>
            {branches.map((b) => (
              <SelectItem key={b.id} value={b.id}>
                {b.name} ({b.code})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="relative min-w-48 flex-1 sm:max-w-xs">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search product or SKU…"
            className="pl-8"
          />
        </div>
        <Button
          variant={lowOnly ? "default" : "outline"}
          size="sm"
          onClick={() => setLowOnly((v) => !v)}
        >
          Low stock only
        </Button>
        <div className="flex-1" />
        <Button onClick={openRestock} disabled={!branchId}>
          <PackagePlus className="mr-1 h-4 w-4" /> Restock
        </Button>
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead className="text-right">In stock</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Stock value</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {items === null && (
              <TableRow>
                <TableCell colSpan={6}>
                  <Skeleton className="h-20 w-full" />
                </TableCell>
              </TableRow>
            )}
            {visible?.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                  {lowOnly
                    ? "Nothing is below its low-stock threshold."
                    : "No stock at this branch yet — use Restock to add some."}
                </TableCell>
              </TableRow>
            )}
            {visible?.map((item) => {
              const low = item.stock < item.product.lowStockThreshold;
              const out = item.stock === 0;
              return (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.product.name}</TableCell>
                  <TableCell className="text-muted-foreground">{item.product.sku}</TableCell>
                  <TableCell className="text-right font-semibold">
                    {item.stock}{" "}
                    <span className="font-normal text-muted-foreground">{item.product.unit}</span>
                  </TableCell>
                  <TableCell>
                    {out ? (
                      <Badge variant="destructive">Out of stock</Badge>
                    ) : low ? (
                      <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">
                        Low stock
                      </Badge>
                    ) : (
                      <Badge variant="secondary">OK</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    ৳{(item.stock * Number(item.product.price)).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setAdjustItem(item);
                        setAdjustDelta("");
                        setAdjustNote("");
                      }}
                    >
                      <SlidersHorizontal className="mr-1 h-3.5 w-3.5" /> Adjust
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Restock dialog */}
      <Dialog open={restockOpen} onOpenChange={setRestockOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Restock</DialogTitle>
            <DialogDescription>Add received stock to this branch.</DialogDescription>
          </DialogHeader>
          <form onSubmit={submitRestock} className="space-y-4">
            <div className="space-y-2">
              <Label>Product</Label>
              <Select value={restockProductId} onValueChange={setRestockProductId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose product" />
                </SelectTrigger>
                <SelectContent>
                  {allProducts.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} ({p.sku})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="r-qty">Quantity received</Label>
              <Input
                id="r-qty"
                type="number"
                min="1"
                required
                value={restockQty}
                onChange={(e) => setRestockQty(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="r-note">Note (optional)</Label>
              <Input
                id="r-note"
                value={restockNote}
                onChange={(e) => setRestockNote(e.target.value)}
                placeholder="Supplier, invoice no…"
              />
            </div>
            <DialogFooter>
              <Button
                type="submit"
                className="w-full"
                disabled={busy || !restockProductId || !restockQty}
              >
                {busy ? "Adding…" : "Add stock"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Adjust dialog */}
      <Dialog open={adjustItem !== null} onOpenChange={(o) => !o && setAdjustItem(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Adjust stock</DialogTitle>
            <DialogDescription>
              {adjustItem &&
                `${adjustItem.product.name} — currently ${adjustItem.stock} ${adjustItem.product.unit}. Use a negative number to remove stock (damage, loss, count correction).`}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submitAdjust} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="a-delta">Change (+/-)</Label>
              <Input
                id="a-delta"
                type="number"
                required
                value={adjustDelta}
                onChange={(e) => setAdjustDelta(e.target.value)}
                placeholder="-2"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="a-note">Reason</Label>
              <Input
                id="a-note"
                value={adjustNote}
                onChange={(e) => setAdjustNote(e.target.value)}
                placeholder="Damaged, expired, recount…"
              />
            </div>
            <DialogFooter>
              <Button
                type="submit"
                className="w-full"
                disabled={busy || !adjustDelta || Number(adjustDelta) === 0}
              >
                {busy ? "Adjusting…" : "Apply adjustment"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
