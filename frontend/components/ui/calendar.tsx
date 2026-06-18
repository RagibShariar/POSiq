"use client";

import "react-day-picker/style.css";
import * as React from "react";
import { DayPicker, type DayPickerProps } from "react-day-picker";

import { cn } from "@/lib/utils";

function Calendar({ className, ...props }: DayPickerProps) {
  return (
    <DayPicker
      showOutsideDays
      className={cn("rdp-theme text-sm", className)}
      // Theme react-day-picker to the app palette (inline wins var resolution).
      style={
        {
          "--rdp-accent-color": "var(--primary)",
          "--rdp-accent-background-color": "var(--accent)",
          "--rdp-day_button-border-radius": "8px",
          "--rdp-range_middle-color": "var(--foreground)",
        } as React.CSSProperties
      }
      {...props}
    />
  );
}

export { Calendar };
