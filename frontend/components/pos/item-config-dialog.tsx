"use client";

import { Minus, Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ProductDetail, SelectedModifier } from "@/lib/types";

const money = (n: number) => `৳${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

export interface ItemConfig {
  qty: number;
  variationId?: string;
  variationName?: string;
  unitPrice: number; // base price (variation price, or product price)
  modifiers: SelectedModifier[];
  specialNote?: string;
}

export function ItemConfigDialog({
  product,
  onClose,
  onAdd,
}: {
  product: ProductDetail | null;
  onClose: () => void;
  onAdd: (config: ItemConfig) => void;
}) {
  const [variationId, setVariationId] = useState<string>("");
  const [selected, setSelected] = useState<Record<string, number>>({});
  const [note, setNote] = useState("");
  const [qty, setQty] = useState(1);

  // Reset state whenever a new product is opened.
  useEffect(() => {
    if (!product) return;
    const def =
      product.variations?.find((v) => v.isDefault) ?? product.variations?.[0] ?? null;
    setVariationId(def?.id ?? "");
    setSelected({});
    setNote("");
    setQty(1);
  }, [product]);

  const groups = useMemo(
    () => (product?.modifierGroups ?? []).map((l) => l.modifierGroup).filter((g) => g.isActive),
    [product]
  );

  const basePrice = useMemo(() => {
    if (!product) return 0;
    if (variationId) {
      const v = product.variations?.find((x) => x.id === variationId);
      if (v) return Number(v.price);
    }
    return Number(product.price);
  }, [product, variationId]);

  const modifiersTotal = useMemo(() => {
    if (!product) return 0;
    let sum = 0;
    for (const g of groups) {
      for (const it of g.items) {
        const q = selected[it.id];
        if (q) sum += Number(it.price) * q;
      }
    }
    return sum;
  }, [product, groups, selected]);

  const lineTotal = (basePrice + modifiersTotal) * qty;

  function toggleItem(groupId: string, itemId: string, singleSelect: boolean) {
    setSelected((prev) => {
      const next = { ...prev };
      if (next[itemId]) {
        delete next[itemId];
        return next;
      }
      if (singleSelect) {
        // Clear any other selection within this single-select group.
        const group = groups.find((g) => g.id === groupId);
        group?.items.forEach((it) => delete next[it.id]);
      }
      next[itemId] = 1;
      return next;
    });
  }

  function handleAdd() {
    if (!product) return;
    const v = product.variations?.find((x) => x.id === variationId);
    const modifiers: SelectedModifier[] = groups.flatMap((g) =>
      g.items
        .filter((it) => selected[it.id])
        .map((it) => ({
          modifierItemId: it.id,
          name: it.name,
          price: Number(it.price),
          quantity: selected[it.id],
        }))
    );
    onAdd({
      qty,
      variationId: v?.id,
      variationName: v?.name,
      unitPrice: basePrice,
      modifiers,
      specialNote: note.trim() || undefined,
    });
  }

  const hasVariations = (product?.variations?.length ?? 0) > 0;

  return (
    <Dialog open={product !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{product?.name}</DialogTitle>
        </DialogHeader>

        {product && (
          <div className="space-y-4">
            {/* Variations (required choice) */}
            {hasVariations && (
              <div className="space-y-2">
                <div className="text-sm font-semibold">
                  Choose option <span className="text-red-500">*</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {product.variations.map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => setVariationId(v.id)}
                      className={`flex items-center justify-between rounded-lg border px-3 py-2 text-sm transition-all ${
                        variationId === v.id
                          ? "border-primary bg-primary/5 font-semibold"
                          : "hover:border-primary/50"
                      }`}
                    >
                      <span>{v.name}</span>
                      <span className="text-muted-foreground">{money(Number(v.price))}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Modifier groups */}
            {groups.map((g) => {
              const single = g.maxSelect === 1;
              return (
                <div key={g.id} className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    {g.name}
                    <Badge variant="secondary" className="font-normal">
                      {single ? "pick one" : `up to ${g.maxSelect}`}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {g.items.map((it) => {
                      const active = !!selected[it.id];
                      return (
                        <button
                          key={it.id}
                          type="button"
                          onClick={() => toggleItem(g.id, it.id, single)}
                          className={`rounded-full border px-3 py-1.5 text-sm transition-all ${
                            active
                              ? "border-primary bg-primary text-primary-foreground"
                              : "hover:border-primary/50"
                          }`}
                        >
                          {it.name}
                          {Number(it.price) > 0 && (
                            <span className={active ? "" : "text-muted-foreground"}>
                              {" "}
                              +{money(Number(it.price))}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {/* Special instructions */}
            <div className="space-y-1.5">
              <div className="text-sm font-semibold">Special instructions</div>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                placeholder="e.g. no sugar, extra hot…"
                className="w-full resize-none rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            {/* Quantity */}
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold">Quantity</span>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setQty((q) => Math.max(1, q - 1))}
                >
                  <Minus className="h-3.5 w-3.5" />
                </Button>
                <span className="w-8 text-center font-bold">{qty}</span>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setQty((q) => q + 1)}
                >
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button className="h-11 w-full text-base" onClick={handleAdd}>
            Add to cart · {money(lineTotal)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
