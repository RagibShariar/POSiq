"use client";

import JsBarcode from "jsbarcode";
import { useEffect, useRef, useState } from "react";
import type { BarcodeSymbology } from "@/lib/types";

interface BarcodeProps {
  value: string;
  type?: BarcodeSymbology;
  height?: number;
  width?: number; // bar width factor
  className?: string;
}

// Renders a scannable barcode into an inline SVG via JsBarcode.
// Invalid input for a strict symbology (e.g. letters in EAN13) falls back to
// CODE128 so a sticker never renders blank.
export function Barcode({ value, type = "CODE128", height = 38, width = 1.4, className }: BarcodeProps) {
  const ref = useRef<SVGSVGElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!ref.current) return;
    const render = (format: string) =>
      JsBarcode(ref.current, value || " ", {
        format,
        height,
        width,
        displayValue: true,
        fontSize: 11,
        margin: 0,
        textMargin: 1,
      });
    try {
      render(type);
      setFailed(false);
    } catch {
      try {
        render("CODE128");
        setFailed(false);
      } catch {
        setFailed(true);
      }
    }
  }, [value, type, height, width]);

  if (failed) {
    return <span className="text-[10px] text-red-500">invalid code</span>;
  }
  return <svg ref={ref} className={className} />;
}
