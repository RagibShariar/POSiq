"use client";

import {
  ArrowDownRight,
  ArrowUpRight,
  ChartArea,
  ChartColumn,
  ChartLine,
  ChartPie,
  Donut,
  Download,
} from "lucide-react";
import { Fragment, useCallback, useEffect, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  DateRangePicker,
  lastNDays,
  rangeLabel,
  type DateRangeValue,
} from "@/components/date-range-picker";
import { methodColor, methodLabel } from "@/components/pos/payment-methods";
import { platformColor, platformLabel } from "@/lib/platforms";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Hint } from "@/components/ui/hint";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip as HoverCard,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { api } from "@/lib/api";
import type { DashboardExtras, ProductReport, SalesReport, SummaryReport } from "@/lib/types";

const money = (n: number) => `৳${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
const money2 = (n: number) => `৳${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;

// Shift a YYYY-MM-DD date string by N days (UTC-safe).
const shiftDate = (iso: string, days: number) => {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};
const daysInRange = (from: string, to: string) =>
  Math.max(
    1,
    Math.round(
      (new Date(to + "T00:00:00Z").getTime() - new Date(from + "T00:00:00Z").getTime()) / 86400000
    ) + 1
  );

const colorFor = (method: string) => methodColor(method);
const labelFor = (method: string) => methodLabel(method);

function downloadCsv(filename: string, rows: Record<string, string | number>[]) {
  if (rows.length === 0) return;
  const headers = Object.keys(rows[0]);
  const esc = (v: string | number) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const csv = [
    headers.join(","),
    ...rows.map((r) => headers.map((h) => esc(r[h])).join(",")),
  ].join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function Delta({ pct }: { pct: number | null }) {
  if (pct === null) return <span className="text-xs text-muted-foreground">—</span>;
  const up = pct >= 0;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-xs font-medium ${up ? "text-emerald-600" : "text-red-600"}`}
    >
      <Icon className="h-3 w-3" />
      {Math.abs(pct)}% vs yesterday
    </span>
  );
}

function Stat({
  label,
  value,
  accent,
  sub,
}: {
  label: string;
  value: string;
  accent?: boolean;
  sub?: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border bg-background p-3">
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className={`mt-1 font-bold ${accent ? "text-2xl text-primary" : "text-xl"}`}>{value}</div>
      {sub && <div className="mt-0.5">{sub}</div>}
    </div>
  );
}

// Remembers a small UI choice (e.g. chosen chart type) across reloads.
function usePref<T extends string>(key: string, fallback: T): [T, (v: T) => void] {
  const [val, setVal] = useState<T>(() => {
    if (typeof window === "undefined") return fallback;
    return (localStorage.getItem(key) as T) || fallback;
  });
  const set = (v: T) => {
    setVal(v);
    try {
      localStorage.setItem(key, v);
    } catch {
      /* private mode — ignore */
    }
  };
  return [val, set];
}

interface ChartOpt<T extends string> {
  id: T;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

// Segmented icon group for picking a chart type.
function ChartToggle<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: ChartOpt<T>[];
}) {
  return (
    <div className="flex items-center gap-0.5 rounded-md border bg-muted/40 p-0.5">
      {options.map((o) => {
        const active = o.id === value;
        return (
          <Hint key={o.id} label={o.label}>
            <button
              type="button"
              onClick={() => onChange(o.id)}
              aria-label={o.label}
              aria-pressed={active}
              className={`flex h-7 w-7 items-center justify-center rounded transition-colors ${
                active
                  ? "bg-background text-primary shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <o.icon className="h-4 w-4" />
            </button>
          </Hint>
        );
      })}
    </div>
  );
}

type RevType = "area" | "line" | "bar";
type IncomeType = "donut" | "pie" | "bar";

const REV_OPTS: ChartOpt<RevType>[] = [
  { id: "area", label: "Area chart", icon: ChartArea },
  { id: "line", label: "Line chart", icon: ChartLine },
  { id: "bar", label: "Bar chart", icon: ChartColumn },
];
const INCOME_OPTS: ChartOpt<IncomeType>[] = [
  { id: "donut", label: "Donut chart", icon: Donut },
  { id: "pie", label: "Pie chart", icon: ChartPie },
  { id: "bar", label: "Bar chart", icon: ChartColumn },
];

const REV_COLOR = "#3b82f6";

// Revenue over time — the user picks area / line / bar.
function RevenueChart({
  data,
  type,
  gradientId = "rev",
}: {
  data: SalesReport["daily"];
  type: RevType;
  gradientId?: string;
}) {
  const margin = { left: 4, right: 8, top: 4 };
  const areaId = `${gradientId}-area`;
  const barId = `${gradientId}-bar`;

  if (type === "line") {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={margin}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
          <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
          <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={48} />
          <Tooltip formatter={(value) => [money(Number(value ?? 0)), "Revenue"]} />
          <Line type="monotone" dataKey="revenue" stroke={REV_COLOR} strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    );
  }
  if (type === "bar") {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={margin}>
          <defs>
            <linearGradient id={barId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={REV_COLOR} stopOpacity={0.95} />
              <stop offset="100%" stopColor={REV_COLOR} stopOpacity={0.4} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
          <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
          <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={48} />
          <Tooltip
            cursor={{ fill: "var(--color-muted)", opacity: 0.4 }}
            formatter={(value) => [money(Number(value ?? 0)), "Revenue"]}
          />
          <Bar dataKey="revenue" fill={`url(#${barId})`} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    );
  }
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={margin}>
        <defs>
          <linearGradient id={areaId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={REV_COLOR} stopOpacity={0.4} />
            <stop offset="95%" stopColor={REV_COLOR} stopOpacity={0.04} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
        <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
        <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={48} />
        <Tooltip formatter={(value) => [money(Number(value ?? 0)), "Revenue"]} />
        <Area type="monotone" dataKey="revenue" stroke={REV_COLOR} strokeWidth={2} fill={`url(#${areaId})`} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

// Income split by payment source — donut / pie / horizontal bar.
function IncomeChart({
  data,
  type,
}: {
  data: SalesReport["byPaymentMethod"];
  type: IncomeType;
}) {
  if (type === "bar") {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ left: 4, right: 16, top: 4, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--color-border)" />
          <XAxis
            type="number"
            tickFormatter={(v) => money(Number(v))}
            tick={{ fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="method"
            tickFormatter={labelFor}
            width={92}
            tick={{ fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            cursor={{ fill: "var(--color-muted)", opacity: 0.4 }}
            formatter={(value, _n, item) => [
              money(Number(value ?? 0)),
              labelFor((item?.payload as { method: string })?.method ?? ""),
            ]}
          />
          <Bar dataKey="revenue" radius={[0, 4, 4, 0]}>
            {data.map((m) => (
              <Cell key={m.method} fill={colorFor(m.method)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    );
  }
  const inner = type === "donut" ? 45 : 0;
  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={data}
          dataKey="revenue"
          nameKey="method"
          innerRadius={inner}
          outerRadius={80}
          paddingAngle={type === "donut" ? 2 : 0}
        >
          {data.map((m) => (
            <Cell key={m.method} fill={colorFor(m.method)} />
          ))}
        </Pie>
        <Tooltip
          formatter={(value, _n, item) => [
            money(Number(value ?? 0)),
            labelFor((item?.payload as { method: string })?.method ?? ""),
          ]}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

const CAT_COLORS = [
  "#27496d", "#0d9488", "#e0964a", "#7c3aed", "#e11d48", "#16a34a", "#0ea5e9", "#d97706",
];

// Category revenue split — donut / pie / horizontal bar.
function CategoryChart({
  data,
  type,
}: {
  data: { category: string; revenue: number }[];
  type: IncomeType;
}) {
  const rows = data.map((d, i) => ({ ...d, color: CAT_COLORS[i % CAT_COLORS.length] }));
  if (type === "bar") {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} layout="vertical" margin={{ left: 4, right: 16, top: 4, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--color-border)" />
          <XAxis
            type="number"
            tickFormatter={(v) => money(Number(v))}
            tick={{ fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="category"
            width={96}
            tick={{ fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            cursor={{ fill: "var(--color-muted)", opacity: 0.4 }}
            formatter={(value) => [money(Number(value ?? 0)), "Revenue"]}
          />
          <Bar dataKey="revenue" radius={[0, 4, 4, 0]}>
            {rows.map((r) => (
              <Cell key={r.category} fill={r.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    );
  }
  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={rows}
          dataKey="revenue"
          nameKey="category"
          innerRadius={type === "donut" ? 45 : 0}
          outerRadius={80}
          paddingAngle={type === "donut" ? 2 : 0}
        >
          {rows.map((r) => (
            <Cell key={r.category} fill={r.color} />
          ))}
        </Pie>
        <Tooltip formatter={(value, _n, item) => [
          money(Number(value ?? 0)),
          (item?.payload as { category: string })?.category ?? "",
        ]} />
      </PieChart>
    </ResponsiveContainer>
  );
}

// Semicircular progress gauge (used by the monthly target widget).
function Gauge({ pct }: { pct: number }) {
  const p = Math.max(0, Math.min(pct, 1));
  const cx = 75, cy = 78, r = 58;
  const pt = (a: number) => [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  const [sx, sy] = pt(Math.PI);
  const [ex, ey] = pt(2 * Math.PI);
  const [vx, vy] = pt(Math.PI + p * Math.PI);
  const large = p > 0.5 ? 1 : 0;
  return (
    <svg viewBox="0 0 150 92" className="h-full w-full">
      <path
        d={`M${sx} ${sy} A${r} ${r} 0 0 1 ${ex} ${ey}`}
        fill="none"
        stroke="var(--color-muted)"
        strokeWidth={13}
        strokeLinecap="round"
        opacity={0.4}
      />
      <path
        d={`M${sx} ${sy} A${r} ${r} 0 ${large} 1 ${vx} ${vy}`}
        fill="none"
        stroke="#27496d"
        strokeWidth={13}
        strokeLinecap="round"
      />
      <text x="75" y="74" textAnchor="middle" className="fill-foreground text-[22px] font-bold">
        {Math.round(p * 100)}%
      </text>
    </svg>
  );
}

const DOW_ORDER = [1, 2, 3, 4, 5, 6, 0];
const DOW_LABEL: Record<number, string> = {
  0: "Sun", 1: "Mon", 2: "Tue", 3: "Wed", 4: "Thu", 5: "Fri", 6: "Sat",
};
const hour12 = (h: number) =>
  h === 0 ? "12 AM" : h < 12 ? `${h} AM` : h === 12 ? "12 PM" : `${h - 12} PM`;

type HeatMetric = "revenue" | "orders" | "avg";

interface HeatCellData {
  dow: number;
  hour: number;
  revenue: number;
  orders: number;
}

// One heatmap cell — shaded by intensity, with a rich card tooltip on hover.
function HeatCell({ cell, color }: { cell: HeatCellData | null; color: string }) {
  const revenue = cell?.revenue ?? 0;
  const orders = cell?.orders ?? 0;
  const avg = orders > 0 ? revenue / orders : 0;
  const box = (
    <div className="h-4 cursor-default rounded-[3px]" style={{ backgroundColor: color }} />
  );
  if (!cell) return box;
  return (
    <HoverCard>
      <TooltipTrigger asChild>{box}</TooltipTrigger>
      <TooltipContent className="px-3 py-2">
        <div className="text-[11px] font-bold">
          {DOW_LABEL[cell.dow]} · {hour12(cell.hour)}
        </div>
        <div className="mt-1 space-y-0.5 text-[11px]">
          <div className="flex justify-between gap-5">
            <span className="opacity-70">Revenue</span>
            <span className="font-semibold tabular-nums">{money(revenue)}</span>
          </div>
          <div className="flex justify-between gap-5">
            <span className="opacity-70">Orders</span>
            <span className="font-semibold tabular-nums">{orders}</span>
          </div>
          <div className="flex justify-between gap-5">
            <span className="opacity-70">Avg order</span>
            <span className="font-semibold tabular-nums">{money(avg)}</span>
          </div>
        </div>
      </TooltipContent>
    </HoverCard>
  );
}

// Day × hour heatmap, shaded by the chosen metric. Cells show details on hover.
function Heatmap({ data, metric = "revenue" }: { data: HeatCellData[]; metric?: HeatMetric }) {
  if (data.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">No sales in this period.</p>;
  }
  const valueOf = (c: HeatCellData) =>
    metric === "revenue" ? c.revenue : metric === "orders" ? c.orders : c.orders > 0 ? c.revenue / c.orders : 0;

  const hours = [...new Set(data.map((d) => d.hour))].sort((a, b) => a - b);
  const lo = Math.min(...hours);
  const hi = Math.max(...hours);
  const cols: number[] = [];
  for (let h = lo; h <= hi; h++) cols.push(h);
  const max = Math.max(...data.map(valueOf), 1);
  const lookup = new Map(data.map((d) => [`${d.dow}:${d.hour}`, d]));

  return (
    <div className="overflow-x-auto">
      <div
        className="grid gap-[3px]"
        style={{ gridTemplateColumns: `34px repeat(${cols.length}, minmax(14px, 1fr))` }}
      >
        <div />
        {cols.map((h) => (
          <div key={h} className="text-center text-[9px] text-muted-foreground">
            {h}
          </div>
        ))}
        {DOW_ORDER.map((dow) => (
          <Fragment key={dow}>
            <div className="flex items-center text-[10px] text-muted-foreground">{DOW_LABEL[dow]}</div>
            {cols.map((h) => {
              const cell = lookup.get(`${dow}:${h}`) ?? null;
              const v = cell ? valueOf(cell) : 0;
              const a = v > 0 ? 0.12 + (v / max) * 0.88 : 0;
              const color = v > 0 ? `rgba(39,73,109,${a.toFixed(2)})` : "var(--color-muted)";
              return <HeatCell key={h} cell={v > 0 ? cell : null} color={color} />;
            })}
          </Fragment>
        ))}
      </div>
    </div>
  );
}

const HEAT_METRICS: { id: HeatMetric; label: string }[] = [
  { id: "revenue", label: "Revenue" },
  { id: "orders", label: "Orders" },
  { id: "avg", label: "Avg order" },
];

// H6 — the same heatmap with a metric switch (revenue / orders / avg order value).
function BusiestByMetric({ data, period }: { data: HeatCellData[]; period: string }) {
  const [metric, setMetric] = usePref<HeatMetric>("dash.heatMetric", "revenue");
  const valueOf = (c: HeatCellData) =>
    metric === "revenue" ? c.revenue : metric === "orders" ? c.orders : c.orders > 0 ? c.revenue / c.orders : 0;
  let peak: (HeatCellData & { v: number }) | null = null;
  for (const c of data) {
    const v = valueOf(c);
    if (!peak || v > peak.v) peak = { ...c, v };
  }
  const peakText =
    metric === "revenue" ? money(peak?.v ?? 0) : metric === "orders" ? `${peak?.v ?? 0} orders` : `${money(peak?.v ?? 0)} avg order`;

  // Best day & peak hour — aggregate revenue/orders, then rank by the chosen metric.
  const dayAgg = new Map<number, { rev: number; ord: number }>();
  const hourAgg = new Map<number, { rev: number; ord: number }>();
  for (const c of data) {
    const d = dayAgg.get(c.dow) ?? { rev: 0, ord: 0 };
    d.rev += c.revenue;
    d.ord += c.orders;
    dayAgg.set(c.dow, d);
    const h = hourAgg.get(c.hour) ?? { rev: 0, ord: 0 };
    h.rev += c.revenue;
    h.ord += c.orders;
    hourAgg.set(c.hour, h);
  }
  const mv = (a: { rev: number; ord: number }) =>
    metric === "revenue" ? a.rev : metric === "orders" ? a.ord : a.ord > 0 ? a.rev / a.ord : 0;
  let bestDay: number | null = null;
  let bestDayV = -1;
  for (const [d, a] of dayAgg) {
    const v = mv(a);
    if (v > bestDayV) { bestDayV = v; bestDay = d; }
  }
  let peakHour: number | null = null;
  let peakHourV = -1;
  for (const [h, a] of hourAgg) {
    const v = mv(a);
    if (v > peakHourV) { peakHourV = v; peakHour = h; }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="text-base">
          Busiest times by metric{" "}
          <span className="ml-1 text-sm font-normal text-muted-foreground">({period})</span>
        </CardTitle>
        <div className="flex items-center gap-0.5 rounded-md border bg-muted/40 p-0.5">
          {HEAT_METRICS.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setMetric(m.id)}
              className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                metric === m.id
                  ? "bg-background text-primary shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        <Heatmap data={data} metric={metric} />
        {peak && peak.v > 0 && (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t pt-3 text-sm text-muted-foreground">
            <div className="flex items-center gap-2 text-xs">
              <span>Low</span>
              <span
                className="h-2.5 w-24 rounded-full"
                style={{
                  background: "linear-gradient(90deg, rgba(39,73,109,0.12), rgba(39,73,109,1))",
                }}
              />
              <span>High</span>
            </div>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span>
                Busiest:{" "}
                <span className="font-semibold text-foreground">
                  {DOW_LABEL[peak.dow]} · {hour12(peak.hour)}
                </span>{" "}
                — {peakText}
              </span>
              {bestDay !== null && (
                <>
                  <span className="text-border">·</span>
                  <span>
                    Best day:{" "}
                    <span className="font-semibold text-foreground">{DOW_LABEL[bestDay]}</span>
                  </span>
                </>
              )}
              {peakHour !== null && (
                <>
                  <span className="text-border">·</span>
                  <span>
                    Peak hour:{" "}
                    <span className="font-semibold text-foreground">{hour12(peakHour)}</span>
                  </span>
                </>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// D06 — this period vs the previous one, as line / area / grouped bars.
function PeriodCompareChart({
  data,
  type,
}: {
  data: { label: string; current: number; previous: number }[];
  type: RevType;
}) {
  const margin = { left: 4, right: 8, top: 4 };
  const grid = (
    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
  );
  const xa = (
    <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} minTickGap={20} />
  );
  const ya = <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={48} />;
  const tip = (
    <Tooltip
      formatter={(v, n) => [money(Number(v ?? 0)), n === "current" ? "This period" : "Previous"]}
    />
  );

  if (type === "bar") {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={margin}>
          {grid}
          {xa}
          {ya}
          <Tooltip
            cursor={{ fill: "var(--color-muted)", opacity: 0.4 }}
            formatter={(v, n) => [money(Number(v ?? 0)), n === "current" ? "This period" : "Previous"]}
          />
          <Bar dataKey="previous" fill="#cbd5e1" radius={[3, 3, 0, 0]} />
          <Bar dataKey="current" fill={REV_COLOR} radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    );
  }
  if (type === "area") {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={margin}>
          <defs>
            <linearGradient id="cmp-area" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={REV_COLOR} stopOpacity={0.35} />
              <stop offset="95%" stopColor={REV_COLOR} stopOpacity={0.04} />
            </linearGradient>
          </defs>
          {grid}
          {xa}
          {ya}
          {tip}
          <Area
            type="monotone"
            dataKey="previous"
            stroke="#cbd5e1"
            strokeWidth={2}
            strokeDasharray="4 4"
            fill="none"
          />
          <Area type="monotone" dataKey="current" stroke={REV_COLOR} strokeWidth={2} fill="url(#cmp-area)" />
        </AreaChart>
      </ResponsiveContainer>
    );
  }
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={margin}>
        {grid}
        {xa}
        {ya}
        {tip}
        <Line
          type="monotone"
          dataKey="previous"
          stroke="#cbd5e1"
          strokeWidth={2}
          strokeDasharray="4 4"
          dot={false}
        />
        <Line type="monotone" dataKey="current" stroke={REV_COLOR} strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export default function DashboardPage() {
  const [summary, setSummary] = useState<SummaryReport | null>(null);
  const [sales, setSales] = useState<SalesReport | null>(null);
  const [products, setProducts] = useState<ProductReport | null>(null);
  const [range, setRange] = useState<DateRangeValue>(() => lastNDays(30));
  const [error, setError] = useState<string | null>(null);
  const [extras, setExtras] = useState<DashboardExtras | null>(null);
  const [prevDaily, setPrevDaily] = useState<SalesReport["daily"]>([]);
  const [revType, setRevType] = usePref<RevType>("dash.revChart", "area");
  const [incomeType, setIncomeType] = usePref<IncomeType>("dash.incomeChart", "donut");
  const [hourType, setHourType] = usePref<RevType>("dash.hourChart", "bar");
  const [catType, setCatType] = usePref<IncomeType>("dash.catChart", "donut");
  const [compareType, setCompareType] = usePref<RevType>("dash.compareChart", "line");

  // Today's snapshot — independent of the selected range.
  useEffect(() => {
    api
      .get<SummaryReport>("/reports/summary")
      .then((s) => setSummary(s.data))
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load dashboard"));
  }, []);

  // Analytical sections follow the selected date range (debounced).
  const loadRange = useCallback(() => {
    const q = `from=${range.from}&to=${range.to}`;
    api.get<SalesReport>(`/reports/sales?${q}`).then((r) => setSales(r.data)).catch(() => {});
    api
      .get<ProductReport>(`/reports/products?${q}&limit=8`)
      .then((r) => setProducts(r.data))
      .catch(() => {});
    api.get<DashboardExtras>(`/reports/dashboard?${q}`).then((r) => setExtras(r.data)).catch(() => {});
    // Previous equal-length window (for the "This vs last period" widget).
    const n = daysInRange(range.from, range.to);
    const prevTo = shiftDate(range.from, -1);
    const prevFrom = shiftDate(range.from, -n);
    api
      .get<SalesReport>(`/reports/sales?from=${prevFrom}&to=${prevTo}`)
      .then((r) => setPrevDaily(r.data.daily))
      .catch(() => {});
  }, [range]);

  useEffect(() => {
    if (!range.from || !range.to) return;
    const t = setTimeout(loadRange, 300);
    return () => clearTimeout(t);
  }, [loadRange, range.from, range.to]);

  if (error) return <p className="text-sm text-destructive">{error}</p>;

  if (!summary || !sales || !products) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-40" />
        <div className="grid gap-4 lg:grid-cols-3">
          <Skeleton className="h-72 lg:col-span-2" />
          <Skeleton className="h-72" />
        </div>
      </div>
    );
  }

  const t = summary.today;
  const period = rangeLabel(range);
  const Period = ({ label }: { label: string }) => (
    <span className="ml-1 text-sm font-normal text-muted-foreground">({label})</span>
  );
  // D06 — align this period's daily revenue against the preceding equal window.
  const periodDays = daysInRange(range.from, range.to);
  const curMap = new Map(sales.daily.map((d) => [d.date, d.revenue]));
  const prevMap = new Map(prevDaily.map((d) => [d.date, d.revenue]));
  const periodCompare = Array.from({ length: periodDays }, (_, i) => ({
    label: shiftDate(range.from, i).slice(5),
    current: curMap.get(shiftDate(range.from, i)) ?? 0,
    previous: prevMap.get(shiftDate(range.from, i - periodDays)) ?? 0,
  }));
  const curTotal = periodCompare.reduce((s, p) => s + p.current, 0);
  const prevTotal = periodCompare.reduce((s, p) => s + p.previous, 0);
  const periodDelta = prevTotal > 0 ? Number((((curTotal - prevTotal) / prevTotal) * 100).toFixed(1)) : null;

  const incomeTotal = sales.byPaymentMethod.reduce((s, m) => s + m.revenue, 0);
  const incomeLegend = (
    <div className="flex-1 space-y-2">
      {sales.byPaymentMethod.map((m) => {
        const pct = incomeTotal > 0 ? (m.revenue / incomeTotal) * 100 : 0;
        return (
          <div key={m.method} className="flex items-center gap-2 text-sm">
            <span
              className="h-3 w-3 shrink-0 rounded-full"
              style={{ backgroundColor: colorFor(m.method) }}
            />
            <span className="flex-1 font-medium">{labelFor(m.method)}</span>
            <span className="text-right">
              <span className="font-semibold">{money(m.revenue)}</span>
              <span className="ml-2 text-xs text-muted-foreground">
                {pct.toFixed(1)}% · {m.orders} order{m.orders === 1 ? "" : "s"}
              </span>
            </span>
          </div>
        );
      })}
    </div>
  );
  const orderStatRows = [
    { metric: "Total orders", value: sales.totals.orders },
    { metric: "Total items sold", value: sales.orderStats.itemsSold },
    { metric: "Average order value", value: money2(sales.totals.avgOrderValue) },
    { metric: "Cancelled (refunded) orders", value: sales.orderStats.cancelled },
    { metric: "Void orders", value: sales.orderStats.voided },
    { metric: "Discounted orders", value: sales.orderStats.discounted },
  ];

  return (
    <div className="space-y-6">
      {/* ── Date range (drives the analytical sections below) ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Dashboard</h2>
        <DateRangePicker value={range} onChange={setRange} />
      </div>

      {/* ── Total Sales (today) ───────────────────────── */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base">
            Total Sales <Period label="Today" />
          </CardTitle>
          <Delta pct={summary.deltas.revenuePct} />
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <Stat label="Today's revenue" value={money(t.netRevenue)} accent />
            <Stat label="Gross sales" value={money(t.grossRevenue)} />
            <Stat label="Net sales" value={money(t.netRevenue)} />
            <Stat label="Total tax" value={money(t.totalTax)} />
            <Stat label="Items sold today" value={String(t.itemsSold)} />
            <Stat
              label="Total orders"
              value={String(t.orders)}
              sub={<Delta pct={summary.deltas.ordersPct} />}
            />
          </div>
        </CardContent>
      </Card>

      {/* ── Revenue chart + payment methods ───────────── */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <CardTitle className="text-base">
              Revenue <Period label={period} />
            </CardTitle>
            <div className="flex items-center gap-2">
              <ChartToggle value={revType} onChange={setRevType} options={REV_OPTS} />
              <Hint label="Download CSV">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => downloadCsv(`revenue_${range.from}_${range.to}`, sales.daily)}
                >
                  <Download className="h-4 w-4" />
                </Button>
              </Hint>
            </div>
          </CardHeader>
          <CardContent className="h-72">
            <RevenueChart data={sales.daily} type={revType} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">
              Payment methods <Period label={period} />
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                downloadCsv(
                  `payment-methods_${range.from}_${range.to}`,
                  sales.byPaymentMethod.map((m) => ({
                    method: labelFor(m.method),
                    orders: m.orders,
                    revenue: m.revenue,
                  }))
                )
              }
            >
              <Download className="mr-1 h-4 w-4" /> Download
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {sales.byPaymentMethod.length === 0 && (
              <p className="text-sm text-muted-foreground">No sales yet.</p>
            )}
            {sales.byPaymentMethod.map((m, i) => {
              const share = incomeTotal > 0 ? Math.round((m.revenue / incomeTotal) * 100) : 0;
              return (
                <div key={m.method}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="font-medium">{labelFor(m.method)}</span>
                    <span className="text-muted-foreground">
                      {money(m.revenue)} · {share}%
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-muted">
                    <div
                      className="h-2 rounded-full"
                      style={{ width: `${share}%`, backgroundColor: colorFor(m.method) }}
                    />
                  </div>
                </div>
              );
            })}
            <div className="border-t pt-3 text-sm text-muted-foreground">
              Net revenue:{" "}
              <span className="font-semibold text-foreground">{money(sales.totals.netRevenue)}</span>{" "}
              from {sales.totals.orders} orders
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Income overview (pie) + order statistics ──── */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <CardTitle className="text-base">
              Income overview <Period label={period} />
            </CardTitle>
            <div className="flex items-center gap-2">
              <ChartToggle value={incomeType} onChange={setIncomeType} options={INCOME_OPTS} />
              <Hint label="Download CSV">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() =>
                    downloadCsv(
                      `income-overview_${range.from}_${range.to}`,
                      sales.byPaymentMethod.map((m) => ({
                        source: labelFor(m.method),
                        amount: m.revenue,
                        percent:
                          incomeTotal > 0 ? Math.round((m.revenue / incomeTotal) * 1000) / 10 : 0,
                        orders: m.orders,
                      }))
                    )
                  }
                >
                  <Download className="h-4 w-4" />
                </Button>
              </Hint>
            </div>
          </CardHeader>
          <CardContent>
            {incomeTotal === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">No income yet.</p>
            ) : incomeType === "bar" ? (
              <div className="space-y-4">
                <div className="h-56 w-full">
                  <IncomeChart data={sales.byPaymentMethod} type={incomeType} />
                </div>
                {incomeLegend}
              </div>
            ) : (
              <div className="flex flex-col items-center gap-4 sm:flex-row">
                <div className="h-44 w-44 shrink-0">
                  <IncomeChart data={sales.byPaymentMethod} type={incomeType} />
                </div>
                {incomeLegend}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Order statistics <Period label={period} />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableBody>
                {orderStatRows.map((r) => (
                  <TableRow key={r.metric}>
                    <TableCell className="text-muted-foreground">{r.metric}</TableCell>
                    <TableCell className="text-right font-semibold">{r.value}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* ── Sales by platform ─────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Sales by platform <Period label={period} />
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {sales.byPlatform.length === 0 ? (
            <p className="text-sm text-muted-foreground">No sales in this period.</p>
          ) : (
            sales.byPlatform
              .slice()
              .sort((a, b) => b.revenue - a.revenue)
              .map((p) => {
                const total = sales.byPlatform.reduce((s, x) => s + x.revenue, 0);
                const share = total > 0 ? Math.round((p.revenue / total) * 100) : 0;
                return (
                  <div key={p.platform}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="font-medium">{platformLabel(p.platform)}</span>
                      <span className="text-muted-foreground">
                        {money(p.revenue)} · {p.orders} order{p.orders === 1 ? "" : "s"} · {share}%
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-muted">
                      <div
                        className="h-2 rounded-full"
                        style={{ width: `${share}%`, backgroundColor: platformColor(p.platform) }}
                      />
                    </div>
                  </div>
                );
              })
          )}
        </CardContent>
      </Card>

      {/* ── Profit & monthly target ───────────────────── */}
      {extras && (
        <>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">
                  Profit &amp; margin <Period label={period} />
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <Stat label="Gross profit" value={money(extras.profit.grossProfit)} accent />
                  <Stat label="Margin" value={`${extras.profit.margin}%`} />
                  <Stat label="Net revenue" value={money(extras.profit.netRevenue)} />
                  <Stat label="Cost of goods" value={money(extras.profit.cogs)} />
                </div>
                <p className="mt-3 text-xs text-muted-foreground">
                  Cost is estimated from each product&apos;s current cost price.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Monthly sales target</CardTitle>
              </CardHeader>
              <CardContent>
                {extras.monthlyTarget.target > 0 ? (
                  <div className="flex items-center gap-4">
                    <div className="h-24 w-40 shrink-0">
                      <Gauge pct={extras.monthlyTarget.pct / 100} />
                    </div>
                    <div className="flex-1 space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Achieved</span>
                        <span className="font-semibold">{money(extras.monthlyTarget.achieved)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Target</span>
                        <span className="font-semibold">{money(extras.monthlyTarget.target)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Days left this month</span>
                        <span className="font-semibold">{extras.monthlyTarget.daysLeft}</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    Set a monthly target in <span className="font-medium text-foreground">Settings → Business</span> to track progress here.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* ── Peak hours + sales by branch ── */}
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">
                  Peak hours <Period label={period} />
                </CardTitle>
                <ChartToggle value={hourType} onChange={setHourType} options={REV_OPTS} />
              </CardHeader>
              <CardContent className="h-64">
                {extras.byHour.length === 0 ? (
                  <p className="py-10 text-center text-sm text-muted-foreground">No sales in this period.</p>
                ) : (
                  <RevenueChart
                    data={extras.byHour.map((h) => ({
                      date: `${h.hour}`,
                      orders: h.orders,
                      revenue: h.revenue,
                    }))}
                    type={hourType}
                    gradientId="hour"
                  />
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Sales by branch <Period label={period} />
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {extras.byBranch.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No sales in this period.</p>
                ) : (
                  (() => {
                    const total = extras.byBranch.reduce((s, b) => s + b.revenue, 0);
                    return extras.byBranch.map((b, i) => {
                      const share = total > 0 ? Math.round((b.revenue / total) * 100) : 0;
                      return (
                        <div key={b.branch.id}>
                          <div className="mb-1 flex items-center justify-between text-sm">
                            <span className="font-medium">{b.branch.name}</span>
                            <span className="text-muted-foreground">
                              {money(b.revenue)} · {b.orders} order{b.orders === 1 ? "" : "s"} · {share}%
                            </span>
                          </div>
                          <div className="h-2 rounded-full bg-muted">
                            <div
                              className="h-2 rounded-full"
                              style={{
                                width: `${share}%`,
                                backgroundColor: CAT_COLORS[i % CAT_COLORS.length],
                              }}
                            />
                          </div>
                        </div>
                      );
                    });
                  })()
                )}
              </CardContent>
            </Card>
          </div>

          {/* ── Busiest times (metric-switch heatmap) ── */}
          <BusiestByMetric data={extras.byDayHour} period={period} />

          {/* ── Category sales + This vs last period ── */}
          <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">
                Category sales <Period label={period} />
              </CardTitle>
              <ChartToggle value={catType} onChange={setCatType} options={INCOME_OPTS} />
            </CardHeader>
            <CardContent>
              {extras.byCategory.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">No sales in this period.</p>
              ) : catType === "bar" ? (
                <div className="h-56 w-full">
                  <CategoryChart data={extras.byCategory} type={catType} />
                </div>
              ) : (
                <div className="flex flex-col items-center gap-4 sm:flex-row">
                  <div className="h-44 w-44 shrink-0">
                    <CategoryChart data={extras.byCategory} type={catType} />
                  </div>
                  <div className="flex-1 space-y-2">
                    {(() => {
                      const total = extras.byCategory.reduce((s, c) => s + c.revenue, 0);
                      return extras.byCategory.map((c, i) => {
                        const pct = total > 0 ? (c.revenue / total) * 100 : 0;
                        return (
                          <div key={c.category} className="flex items-center gap-2 text-sm">
                            <span
                              className="h-3 w-3 shrink-0 rounded-full"
                              style={{ backgroundColor: CAT_COLORS[i % CAT_COLORS.length] }}
                            />
                            <span className="flex-1 font-medium">{c.category}</span>
                            <span className="text-right">
                              <span className="font-semibold">{money(c.revenue)}</span>
                              <span className="ml-2 text-xs text-muted-foreground">
                                {pct.toFixed(1)}%
                              </span>
                            </span>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <CardTitle className="text-base">
                This vs last period <Period label={period} />
              </CardTitle>
              <div className="flex items-center gap-2">
                {periodDelta !== null && (
                  <span
                    className={`inline-flex items-center gap-0.5 text-xs font-medium ${
                      periodDelta >= 0 ? "text-emerald-600" : "text-red-600"
                    }`}
                  >
                    {periodDelta >= 0 ? (
                      <ArrowUpRight className="h-3 w-3" />
                    ) : (
                      <ArrowDownRight className="h-3 w-3" />
                    )}
                    {Math.abs(periodDelta)}%
                  </span>
                )}
                <ChartToggle value={compareType} onChange={setCompareType} options={REV_OPTS} />
              </div>
            </CardHeader>
            <CardContent>
              {curTotal === 0 && prevTotal === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">
                  No sales in this period.
                </p>
              ) : (
                <>
                  <div className="h-52">
                    <PeriodCompareChart data={periodCompare} type={compareType} />
                  </div>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t pt-3 text-sm text-muted-foreground">
                    <span className="flex items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: REV_COLOR }}
                      />
                      This period <span className="font-semibold text-foreground">{money(curTotal)}</span>
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
                      Previous <span className="font-semibold text-foreground">{money(prevTotal)}</span>
                    </span>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
          </div>
        </>
      )}

      {/* ── Top selling items + Low-stock items (side by side) ── */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">
              Top selling items <Period label={period} />
            </CardTitle>
            <Hint label="Download CSV">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() =>
                  downloadCsv(
                    `top-selling-items_${range.from}_${range.to}`,
                    products.topProducts.map((p) => ({
                      name: p.name,
                      quantitySold: p.quantitySold,
                      revenue: p.revenue,
                      orders: p.orderCount,
                    }))
                  )
                }
              >
                <Download className="h-4 w-4" />
              </Button>
            </Hint>
          </CardHeader>
          <CardContent>
            {products.topProducts.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No sales in this period.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10 text-center">#</TableHead>
                    <TableHead>Item</TableHead>
                    <TableHead className="text-right">Qty sold</TableHead>
                    <TableHead className="text-right">Orders</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products.topProducts.map((p, i) => (
                    <TableRow key={p.productId}>
                      <TableCell className="text-center text-muted-foreground">{i + 1}</TableCell>
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell className="text-right">{p.quantitySold}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{p.orderCount}</TableCell>
                      <TableCell className="text-right font-semibold">{money(p.revenue)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">
              Low-stock items <Period label="now" />
            </CardTitle>
            {extras && extras.lowStock.length > 0 && (
              <Hint label="Download CSV">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() =>
                    downloadCsv(
                      `low-stock-items_${range.from}_${range.to}`,
                      extras.lowStock.map((p) => ({
                        name: p.name,
                        inStock: p.stock,
                        threshold: p.threshold,
                        status: p.stock <= p.threshold / 2 ? "Critical" : "Low",
                      }))
                    )
                  }
                >
                  <Download className="h-4 w-4" />
                </Button>
              </Hint>
            )}
          </CardHeader>
          <CardContent>
            {!extras ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Loading…</p>
            ) : extras.lowStock.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Everything is above its low-stock threshold. 🎉
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10 text-center">#</TableHead>
                    <TableHead>Item</TableHead>
                    <TableHead className="text-right">In stock</TableHead>
                    <TableHead className="text-right">Threshold</TableHead>
                    <TableHead className="text-right">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {extras.lowStock.map((p, i) => {
                    const critical = p.stock <= p.threshold / 2;
                    return (
                      <TableRow key={p.name}>
                        <TableCell className="text-center text-muted-foreground">{i + 1}</TableCell>
                        <TableCell className="font-medium">{p.name}</TableCell>
                        <TableCell className="text-right">{p.stock}</TableCell>
                        <TableCell className="text-right text-muted-foreground">{p.threshold}</TableCell>
                        <TableCell className="text-right">
                          <span
                            className={`rounded px-2 py-0.5 text-xs font-semibold ${
                              critical ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"
                            }`}
                          >
                            {critical ? "Critical" : "Low"}
                          </span>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
