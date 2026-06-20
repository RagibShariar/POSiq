import type { BarcodeSettings, BarcodeSymbology } from "@/lib/types";

// ── Label sheet presets ───────────────────────────────
// `cols`/`rows` describe an A4/Letter sheet grid; `label` is the human label.
// `roll` presets are single-label continuous rolls (one sticker per "page").
export interface SheetPreset {
  key: string;
  label: string;
  cols: number;
  rows: number;
  // physical label size in millimetres (drives the printed sticker box)
  labelW: number;
  labelH: number;
  // page padding in mm
  pad: number;
  // gap between labels in mm
  gap: number;
  roll?: boolean;
}

export const SHEET_PRESETS: SheetPreset[] = [
  { key: "20-up", label: "20 / sheet · 8.5\" × 11\"", cols: 4, rows: 5, labelW: 48, labelH: 50, pad: 6, gap: 3 },
  { key: "30-up", label: "30 / sheet · 8.5\" × 11\"", cols: 3, rows: 10, labelW: 63, labelH: 25, pad: 6, gap: 2 },
  { key: "40-up", label: "40 / sheet · 8.5\" × 11\"", cols: 4, rows: 10, labelW: 48, labelH: 25, pad: 6, gap: 2 },
  { key: "65-up", label: "65 / sheet · 8.5\" × 11\"", cols: 5, rows: 13, labelW: 38, labelH: 19, pad: 5, gap: 2 },
  { key: "roll-38x25", label: "Roll · 38mm × 25mm (1-up)", cols: 1, rows: 1, labelW: 38, labelH: 25, pad: 1, gap: 0, roll: true },
  { key: "roll-50x25", label: "Roll · 50mm × 25mm (1-up)", cols: 1, rows: 1, labelW: 50, labelH: 25, pad: 1, gap: 0, roll: true },
  { key: "roll-58x40", label: "Roll · 58mm × 40mm (1-up)", cols: 1, rows: 1, labelW: 58, labelH: 40, pad: 2, gap: 0, roll: true },
];

export const sheetPreset = (key: string): SheetPreset =>
  SHEET_PRESETS.find((s) => s.key === key) ?? SHEET_PRESETS[1];

export const BARCODE_TYPES: { id: BarcodeSymbology; label: string; hint: string }[] = [
  { id: "CODE128", label: "Code 128", hint: "Any letters/numbers — best general purpose" },
  { id: "EAN13", label: "EAN-13", hint: "Exactly 13 digits (retail)" },
  { id: "UPC", label: "UPC-A", hint: "Exactly 12 digits (retail)" },
  { id: "CODE39", label: "Code 39", hint: "Letters + numbers, older scanners" },
];

// Fallbacks so a sticker always has *some* scannable code.
export const codeFor = (sku: string, barcode?: string | null): string =>
  (barcode && barcode.trim()) || sku;

// Defaults mirror the backend DEFAULT_SETTINGS.barcode so the page works
// even before settings load.
export const DEFAULT_BARCODE_SETTINGS: BarcodeSettings = {
  barcodeType: "CODE128",
  sheet: "30-up",
  showProductName: true,
  productNameSize: 13,
  showVariation: false,
  variationSize: 11,
  showPrice: true,
  priceSize: 13,
  priceTaxMode: "inc",
  showBusinessName: true,
  businessNameSize: 11,
  showPackingDate: false,
  packingDateSize: 10,
  showSku: false,
  skuSize: 10,
};
