"use client";

import { Printer, Search, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Barcode } from "@/components/barcode/barcode";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Hint } from "@/components/ui/hint";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { api } from "@/lib/api";
import {
  BARCODE_TYPES,
  DEFAULT_BARCODE_SETTINGS,
  SHEET_PRESETS,
  codeFor,
  sheetPreset,
} from "@/lib/barcode";
import type { BarcodeSettings, Product, ProductDetail, TaxSettings } from "@/lib/types";

const money = (n: number) => `৳${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

interface LabelRow {
  key: string;
  productId: string;
  name: string;
  sku: string;
  barcode?: string | null;
  price: number;
  copies: number;
  packingDate: string;
  variationId?: string;
  variationName?: string;
  variations?: { id: string; name: string; price: number }[];
}

// A flattened, ready-to-print sticker.
interface Sticker {
  name: string;
  variationName?: string;
  sku: string;
  code: string;
  price: number;
  packingDate: string;
}

export default function LabelsPage() {
  const [cfg, setCfg] = useState<BarcodeSettings>(DEFAULT_BARCODE_SETTINGS);
  const [tax, setTax] = useState<TaxSettings | null>(null);
  const [businessName, setBusinessName] = useState("");
  const [currency, setCurrency] = useState("BDT");

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Product[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [rows, setRows] = useState<LabelRow[]>([]);
  const [preview, setPreview] = useState<Sticker[] | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  // Load barcode defaults, tax, and business name.
  useEffect(() => {
    api
      .get<{ tax: TaxSettings; barcode: BarcodeSettings }>("/settings")
      .then((r) => {
        if (r.data.barcode) setCfg({ ...DEFAULT_BARCODE_SETTINGS, ...r.data.barcode });
        setTax(r.data.tax);
      })
      .catch(() => {});
    api
      .get<{ name: string; currency?: string }>("/business")
      .then((r) => {
        setBusinessName(r.data.name);
        if (r.data.currency) setCurrency(r.data.currency);
      })
      .catch(() => {});
  }, []);

  // Product search (debounced).
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    const t = setTimeout(() => {
      api
        .get<Product[]>(`/products?limit=8&search=${encodeURIComponent(query)}`)
        .then((r) => {
          setResults(r.data);
          setShowResults(true);
        })
        .catch(() => {});
    }, 250);
    return () => clearTimeout(t);
  }, [query]);

  async function addProduct(p: Product) {
    setQuery("");
    setResults([]);
    setShowResults(false);
    let variations: LabelRow["variations"];
    if (p.hasVariations) {
      try {
        const detail = await api.get<ProductDetail>(`/products/${p.id}`);
        variations = detail.data.variations
          .filter((v) => v.isActive)
          .map((v) => ({ id: v.id, name: v.name, price: Number(v.price) }));
      } catch {
        /* fall back to base price */
      }
    }
    const first = variations?.[0];
    setRows((prev) => [
      ...prev,
      {
        key: crypto.randomUUID(),
        productId: p.id,
        name: p.name,
        sku: p.sku,
        barcode: p.barcode,
        price: first ? first.price : Number(p.price),
        copies: 1,
        packingDate: "",
        variationId: first?.id,
        variationName: first?.name,
        variations,
      },
    ]);
  }

  function patchRow(key: string, patch: Partial<LabelRow>) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function chooseVariation(key: string, variationId: string) {
    setRows((prev) =>
      prev.map((r) => {
        if (r.key !== key) return r;
        const v = r.variations?.find((x) => x.id === variationId);
        return v ? { ...r, variationId: v.id, variationName: v.name, price: v.price } : r;
      })
    );
  }

  const displayPrice = (base: number) => {
    if (cfg.priceTaxMode === "inc" && tax?.enabled) return base * (1 + (tax.rate || 0) / 100);
    return base;
  };

  function buildPreview() {
    if (rows.length === 0) {
      toast.error("Add at least one product");
      return;
    }
    const stickers: Sticker[] = [];
    for (const r of rows) {
      const n = Math.max(1, Math.min(500, r.copies || 1));
      for (let i = 0; i < n; i++) {
        stickers.push({
          name: r.name,
          variationName: r.variationName,
          sku: r.sku,
          code: codeFor(r.sku, r.barcode),
          price: displayPrice(r.price),
          packingDate: r.packingDate,
        });
      }
    }
    if (stickers.length > 1000) {
      toast.error("Too many labels (max 1000). Reduce copies.");
      return;
    }
    setPreview(stickers);
    setTimeout(() => boxRef.current?.scrollIntoView({ behavior: "smooth" }), 80);
  }

  const totalLabels = useMemo(
    () => rows.reduce((s, r) => s + Math.max(1, r.copies || 1), 0),
    [rows]
  );

  const preset = sheetPreset(cfg.sheet);

  return (
    <div className="space-y-4">
      {/* Print-only stylesheet: hide the app chrome, show just the sheet. */}
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #label-sheet, #label-sheet * { visibility: visible !important; }
          #label-sheet { position: absolute; left: 0; top: 0; width: 100%; }
          @page { margin: ${preset.pad}mm; }
        }
      `}</style>

      <div className="flex items-center justify-between print:hidden">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Print Labels</h1>
          <p className="text-sm text-muted-foreground">
            Generate scannable barcode stickers for your products.
          </p>
        </div>
        {preview && preview.length > 0 && (
          <Button onClick={() => window.print()}>
            <Printer className="mr-1 h-4 w-4" /> Print {preview.length} label{preview.length > 1 ? "s" : ""}
          </Button>
        )}
      </div>

      {/* ── Add products ── */}
      <Card className="print:hidden">
        <CardHeader>
          <CardTitle className="text-base">Add products to generate labels</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => results.length && setShowResults(true)}
              placeholder="Search products by name to add…"
              className="pl-9"
            />
            {showResults && results.length > 0 && (
              <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-md border bg-popover shadow-md">
                {results.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => addProduct(p)}
                    className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-accent"
                  >
                    <span>
                      {p.name}
                      <span className="ml-2 text-xs text-muted-foreground">{p.sku}</span>
                    </span>
                    <span className="text-xs text-muted-foreground">{money(Number(p.price))}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {rows.length === 0 ? (
            <p className="rounded-md border border-dashed py-8 text-center text-sm text-muted-foreground">
              No products added yet. Search above to get started.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead className="w-32">No. of labels</TableHead>
                  <TableHead className="w-44">Packing date</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.key}>
                    <TableCell>
                      <div className="font-medium">{r.name}</div>
                      {r.variations && r.variations.length > 0 ? (
                        <Select
                          value={r.variationId}
                          onValueChange={(v) => chooseVariation(r.key, v)}
                        >
                          <SelectTrigger className="mt-1 h-8 w-48">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {r.variations.map((v) => (
                              <SelectItem key={v.id} value={v.id}>
                                {v.name} · {money(v.price)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <div className="text-xs text-muted-foreground">
                          {r.sku} · {money(r.price)}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min={1}
                        max={500}
                        value={r.copies}
                        onChange={(e) => patchRow(r.key, { copies: Number(e.target.value) })}
                        className="h-9 w-24"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="date"
                        value={r.packingDate}
                        onChange={(e) => patchRow(r.key, { packingDate: e.target.value })}
                        className="h-9"
                      />
                    </TableCell>
                    <TableCell>
                      <Hint label="Remove from list">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setRows((p) => p.filter((x) => x.key !== r.key))}
                        >
                          <Trash2 className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      </Hint>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* ── Label content + layout ── */}
      <Card className="print:hidden">
        <CardHeader>
          <CardTitle className="text-base">Information to show on labels</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <FieldToggle
              label="Product name"
              checked={cfg.showProductName}
              size={cfg.productNameSize}
              onToggle={(v) => setCfg({ ...cfg, showProductName: v })}
              onSize={(s) => setCfg({ ...cfg, productNameSize: s })}
            />
            <FieldToggle
              label="Variation"
              checked={cfg.showVariation}
              size={cfg.variationSize}
              onToggle={(v) => setCfg({ ...cfg, showVariation: v })}
              onSize={(s) => setCfg({ ...cfg, variationSize: s })}
            />
            <FieldToggle
              label="Price"
              checked={cfg.showPrice}
              size={cfg.priceSize}
              onToggle={(v) => setCfg({ ...cfg, showPrice: v })}
              onSize={(s) => setCfg({ ...cfg, priceSize: s })}
            />
            <FieldToggle
              label="Business name"
              checked={cfg.showBusinessName}
              size={cfg.businessNameSize}
              onToggle={(v) => setCfg({ ...cfg, showBusinessName: v })}
              onSize={(s) => setCfg({ ...cfg, businessNameSize: s })}
            />
            <FieldToggle
              label="Packing date"
              checked={cfg.showPackingDate}
              size={cfg.packingDateSize}
              onToggle={(v) => setCfg({ ...cfg, showPackingDate: v })}
              onSize={(s) => setCfg({ ...cfg, packingDateSize: s })}
            />
            <FieldToggle
              label="SKU text"
              checked={cfg.showSku}
              size={cfg.skuSize}
              onToggle={(v) => setCfg({ ...cfg, showSku: v })}
              onSize={(s) => setCfg({ ...cfg, skuSize: s })}
            />
          </div>

          <div className="flex flex-wrap items-end gap-4 border-t pt-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Barcode type</Label>
              <Select
                value={cfg.barcodeType}
                onValueChange={(v) => setCfg({ ...cfg, barcodeType: v as BarcodeSettings["barcodeType"] })}
              >
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BARCODE_TYPES.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Label sheet</Label>
              <Select value={cfg.sheet} onValueChange={(v) => setCfg({ ...cfg, sheet: v })}>
                <SelectTrigger className="w-64">
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
            {cfg.showPrice && (
              <label className="flex items-center gap-2 pb-2 text-sm">
                <input
                  type="checkbox"
                  checked={cfg.priceTaxMode === "inc"}
                  onChange={(e) => setCfg({ ...cfg, priceTaxMode: e.target.checked ? "inc" : "exc" })}
                />
                Price includes tax
              </label>
            )}
          </div>

          <Button onClick={buildPreview} disabled={rows.length === 0}>
            Preview {totalLabels > 0 ? `· ${totalLabels} label${totalLabels > 1 ? "s" : ""}` : ""}
          </Button>
        </CardContent>
      </Card>

      {/* ── Preview / printable sheet ── */}
      {preview && (
        <div ref={boxRef}>
          <div className="mb-2 flex items-center justify-between print:hidden">
            <h2 className="text-sm font-semibold text-muted-foreground">
              Preview — {preview.length} label{preview.length > 1 ? "s" : ""}
            </h2>
            <Button variant="ghost" size="sm" onClick={() => setPreview(null)}>
              <X className="mr-1 h-4 w-4" /> Clear
            </Button>
          </div>
          <div className="overflow-x-auto rounded-lg border bg-white p-4 print:border-0 print:p-0">
            <div
              id="label-sheet"
              style={{
                display: "grid",
                gridTemplateColumns: `repeat(${preset.cols}, ${preset.labelW}mm)`,
                gap: `${preset.gap}mm`,
                justifyContent: "center",
              }}
            >
              {preview.map((s, i) => (
                <StickerBox
                  key={i}
                  s={s}
                  cfg={cfg}
                  businessName={businessName}
                  currency={currency}
                  incTaxLabel={
                    cfg.priceTaxMode === "inc" && tax?.enabled ? tax.label || "VAT" : null
                  }
                  w={preset.labelW}
                  h={preset.labelH}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FieldToggle({
  label,
  checked,
  size,
  onToggle,
  onSize,
}: {
  label: string;
  checked: boolean;
  size: number;
  onToggle: (v: boolean) => void;
  onSize: (s: number) => void;
}) {
  return (
    <div className="rounded-lg border p-3">
      <label className="flex items-center gap-2 text-sm font-medium">
        <input type="checkbox" checked={checked} onChange={(e) => onToggle(e.target.checked)} />
        {label}
      </label>
      <div className="mt-2 flex items-center gap-2">
        <Label className="text-xs text-muted-foreground">Size</Label>
        <Input
          type="number"
          min={6}
          max={40}
          value={size}
          disabled={!checked}
          onChange={(e) => onSize(Number(e.target.value) || 10)}
          className="h-8 w-20"
        />
      </div>
    </div>
  );
}

function StickerBox({
  s,
  cfg,
  businessName,
  currency,
  incTaxLabel,
  w,
  h,
}: {
  s: Sticker;
  cfg: BarcodeSettings;
  businessName: string;
  currency: string;
  incTaxLabel: string | null;
  w: number;
  h: number;
}) {
  const priceText =
    `${currency} ${s.price.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}` + (incTaxLabel ? ` (inc. ${incTaxLabel})` : "");
  return (
    <div
      style={{
        width: `${w}mm`,
        height: `${h}mm`,
        breakInside: "avoid",
      }}
      className="flex flex-col items-center justify-center overflow-hidden border border-dashed border-gray-300 px-1 py-0.5 text-center leading-tight print:border-gray-400"
    >
      {cfg.showBusinessName && businessName && (
        <div style={{ fontSize: cfg.businessNameSize }} className="truncate font-semibold">
          {businessName}
        </div>
      )}
      {cfg.showProductName && (
        <div style={{ fontSize: cfg.productNameSize }} className="line-clamp-2 font-medium">
          {s.name}
        </div>
      )}
      {cfg.showVariation && s.variationName && (
        <div style={{ fontSize: cfg.variationSize }} className="truncate text-gray-600">
          {s.variationName}
        </div>
      )}
      <Barcode value={s.code} type={cfg.barcodeType} height={Math.max(24, h - 16)} width={1.2} />
      {cfg.showSku && (
        <div style={{ fontSize: cfg.skuSize }} className="truncate text-gray-600">
          {s.sku}
        </div>
      )}
      {cfg.showPrice && (
        <div style={{ fontSize: cfg.priceSize }} className="font-bold">
          {priceText}
        </div>
      )}
      {cfg.showPackingDate && s.packingDate && (
        <div style={{ fontSize: cfg.packingDateSize }} className="text-gray-600">
          Pkd: {s.packingDate}
        </div>
      )}
    </div>
  );
}
