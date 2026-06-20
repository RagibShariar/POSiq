"use client";

import { format, parseISO } from "date-fns";
import { CalendarDays } from "lucide-react";
import type { DateRange } from "react-day-picker";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export interface DateRangeValue {
  from: string; // YYYY-MM-DD, or "" for no bound
  to: string;
}

export const daysAgo = (n: number) =>
  new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

export const lastNDays = (n = 30): DateRangeValue => ({ from: daysAgo(n), to: daysAgo(0) });

const toDate = (s: string) => (s ? parseISO(s) : undefined);
const toStr = (d?: Date) => (d ? format(d, "yyyy-MM-dd") : "");

/** Human label for a range, e.g. "Jun 11 – Jun 18, 2026" / "Today" / "All time". */
export function rangeLabel(v: DateRangeValue, emptyLabel = "All time") {
  if (!v.from && !v.to) return emptyLabel;
  if (v.from && v.from === v.to) {
    return v.from === daysAgo(0) ? "Today" : format(parseISO(v.from), "MMM d, yyyy");
  }
  if (v.from && v.to) return `${format(parseISO(v.from), "MMM d")} – ${format(parseISO(v.to), "MMM d, yyyy")}`;
  if (v.from) return `From ${format(parseISO(v.from), "MMM d, yyyy")}`;
  return `Until ${format(parseISO(v.to), "MMM d, yyyy")}`;
}

export function DateRangePicker({
  value,
  onChange,
  presets = [7, 30, 90],
  allowAll = false,
}: {
  value: DateRangeValue;
  onChange: (v: DateRangeValue) => void;
  presets?: number[];
  allowAll?: boolean;
}) {
  const selected: DateRange | undefined =
    value.from || value.to ? { from: toDate(value.from), to: toDate(value.to) } : undefined;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 font-normal">
          <CalendarDays className="h-4 w-4" />
          {rangeLabel(value, allowAll ? "All time" : "Select dates")}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end">
        <div className="mb-2 flex flex-wrap gap-1 border-b pb-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onChange({ from: daysAgo(0), to: daysAgo(0) })}
          >
            Today
          </Button>
          {presets.map((n) => (
            <Button
              key={n}
              variant="ghost"
              size="sm"
              onClick={() => onChange({ from: daysAgo(n), to: daysAgo(0) })}
            >
              Last {n}d
            </Button>
          ))}
          {allowAll && (
            <Button variant="ghost" size="sm" onClick={() => onChange({ from: "", to: "" })}>
              All time
            </Button>
          )}
        </div>
        <Calendar
          mode="range"
          numberOfMonths={2}
          selected={selected}
          defaultMonth={toDate(value.from) ?? toDate(value.to)}
          onSelect={(r) => onChange({ from: toStr(r?.from), to: toStr(r?.to) })}
        />
      </PopoverContent>
    </Popover>
  );
}
