import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";

// Reports never include VOIDED orders. Refunds are reported separately so
// revenue numbers stay reconcilable against the order list.
const SELLABLE: Prisma.OrderWhereInput = { status: { not: "VOIDED" } };

export interface DateRange {
  from: Date;
  to: Date;
  branchId?: string;
}

function orderWhere(businessId: string, range: DateRange): Prisma.OrderWhereInput {
  return {
    businessId,
    ...SELLABLE,
    ...(range.branchId ? { branchId: range.branchId } : {}),
    createdAt: { gte: range.from, lte: range.to },
  };
}

async function salesTotals(businessId: string, range: DateRange) {
  const [orders, refunds] = await Promise.all([
    prisma.order.aggregate({
      where: orderWhere(businessId, range),
      _count: true,
      _sum: { totalAmount: true, discountAmount: true, taxAmount: true },
      _avg: { totalAmount: true },
    }),
    prisma.refund.aggregate({
      where: {
        order: { businessId },
        ...(range.branchId ? { branchId: range.branchId } : {}),
        createdAt: { gte: range.from, lte: range.to },
      },
      _count: true,
      _sum: { amount: true },
    }),
  ]);

  const grossRevenue = Number(orders._sum.totalAmount ?? 0);
  const refunded = Number(refunds._sum.amount ?? 0);

  return {
    orders: orders._count,
    grossRevenue,
    refunds: refunds._count,
    refundedAmount: refunded,
    netRevenue: grossRevenue - refunded,
    avgOrderValue: Number(orders._avg.totalAmount ?? 0),
    totalDiscount: Number(orders._sum.discountAmount ?? 0),
    totalTax: Number(orders._sum.taxAmount ?? 0),
  };
}

// ─── SUMMARY (dashboard KPIs) ────────────────────────
export async function getSummary(businessId: string, branchId?: string) {
  const now = new Date();
  const todayStart = new Date(now); todayStart.setUTCHours(0, 0, 0, 0);
  const yesterdayStart = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000);

  const [today, yesterday, itemsToday, lowStock] = await Promise.all([
    salesTotals(businessId, { from: todayStart, to: now, branchId }),
    salesTotals(businessId, { from: yesterdayStart, to: todayStart, branchId }),
    prisma.orderItem.aggregate({
      where: { order: orderWhere(businessId, { from: todayStart, to: now, branchId }) },
      _sum: { quantity: true },
    }),
    prisma.inventory.findMany({
      where: {
        businessId,
        ...(branchId ? { branchId } : {}),
        product: { deletedAt: null, isActive: true },
      },
      select: { stock: true, product: { select: { lowStockThreshold: true } } },
    }),
  ]);

  const lowStockCount = lowStock.filter((i) => i.stock < i.product.lowStockThreshold).length;

  function delta(current: number, previous: number): number | null {
    if (previous === 0) return null;
    return Number((((current - previous) / previous) * 100).toFixed(1));
  }

  return {
    today: { ...today, itemsSold: itemsToday._sum.quantity ?? 0 },
    yesterday: { orders: yesterday.orders, netRevenue: yesterday.netRevenue },
    deltas: {
      ordersPct: delta(today.orders, yesterday.orders),
      revenuePct: delta(today.netRevenue, yesterday.netRevenue),
    },
    lowStockCount,
  };
}

// ─── SALES (by day, for charts) ──────────────────────
export async function getSalesReport(businessId: string, range: DateRange) {
  const totals = await salesTotals(businessId, range);

  const daily = await prisma.$queryRaw<
    { day: Date; orders: bigint; revenue: number }[]
  >(Prisma.sql`
    SELECT date_trunc('day', "createdAt") AS day,
           COUNT(*)::bigint AS orders,
           COALESCE(SUM("totalAmount"), 0)::float AS revenue
    FROM "Order"
    WHERE "businessId" = ${businessId}
      AND status != 'VOIDED'
      AND "createdAt" >= ${range.from} AND "createdAt" <= ${range.to}
      ${range.branchId ? Prisma.sql`AND "branchId" = ${range.branchId}` : Prisma.empty}
    GROUP BY 1 ORDER BY 1
  `);

  const byPayment = await prisma.order.groupBy({
    by: ["paymentMethod"],
    where: orderWhere(businessId, range),
    _count: true,
    _sum: { totalAmount: true },
  });

  const byPlatformGroups = await prisma.order.groupBy({
    by: ["platform"],
    where: orderWhere(businessId, range),
    _count: true,
    _sum: { totalAmount: true },
  });

  // ── Order statistics (incl. VOIDED, which the rest of the report excludes) ──
  const allInRange: Prisma.OrderWhereInput = {
    businessId,
    ...(range.branchId ? { branchId: range.branchId } : {}),
    createdAt: { gte: range.from, lte: range.to },
  };
  const [itemsAgg, statusGroups, discountedCount] = await Promise.all([
    prisma.orderItem.aggregate({
      where: { order: orderWhere(businessId, range) },
      _sum: { quantity: true },
    }),
    prisma.order.groupBy({ by: ["status"], where: allInRange, _count: true }),
    prisma.order.count({ where: { ...orderWhere(businessId, range), discountAmount: { gt: 0 } } }),
  ]);
  const statusCount = (s: string) => statusGroups.find((g) => g.status === s)?._count ?? 0;

  return {
    totals,
    daily: daily.map((d) => ({
      date: d.day.toISOString().slice(0, 10),
      orders: Number(d.orders),
      revenue: d.revenue,
    })),
    byPaymentMethod: byPayment.map((p) => ({
      method: p.paymentMethod,
      orders: p._count,
      revenue: Number(p._sum.totalAmount ?? 0),
    })),
    byPlatform: byPlatformGroups.map((p) => ({
      platform: p.platform,
      orders: p._count,
      revenue: Number(p._sum.totalAmount ?? 0),
    })),
    orderStats: {
      itemsSold: Number(itemsAgg._sum.quantity ?? 0),
      // No dedicated "cancelled" status yet — a fully-refunded order is the closest equivalent.
      cancelled: statusCount("REFUNDED"),
      voided: statusCount("VOIDED"),
      discounted: discountedCount,
    },
  };
}

// ─── PRODUCTS (best / slow sellers) ──────────────────
export async function getProductReport(businessId: string, range: DateRange, limit = 10) {
  const grouped = await prisma.orderItem.groupBy({
    by: ["productId", "productName"],
    where: { order: orderWhere(businessId, range) },
    _sum: { quantity: true, subtotal: true },
    _count: true,
  });

  const rows = grouped
    .map((g) => ({
      productId: g.productId,
      name: g.productName,
      quantitySold: g._sum.quantity ?? 0,
      revenue: Number(g._sum.subtotal ?? 0),
      orderCount: g._count,
    }))
    .sort((a, b) => b.quantitySold - a.quantitySold);

  // Slow sellers: active products with zero or lowest sales in the range
  const soldIds = new Set(rows.map((r) => r.productId));
  const unsold = await prisma.product.findMany({
    where: { businessId, deletedAt: null, isActive: true, id: { notIn: [...soldIds] } },
    select: { id: true, name: true, sku: true },
    take: limit,
  });

  return {
    topProducts: rows.slice(0, limit),
    slowProducts: [
      ...unsold.map((p) => ({ productId: p.id, name: p.name, quantitySold: 0, revenue: 0 })),
      ...rows.slice(-limit).reverse(),
    ].slice(0, limit),
  };
}

// ─── CASHIERS ────────────────────────────────────────
export async function getCashierReport(businessId: string, range: DateRange) {
  const grouped = await prisma.order.groupBy({
    by: ["cashierId"],
    where: orderWhere(businessId, range),
    _count: true,
    _sum: { totalAmount: true },
    _avg: { totalAmount: true },
  });

  const cashiers = await prisma.user.findMany({
    where: { id: { in: grouped.map((g) => g.cashierId) } },
    select: { id: true, name: true, email: true, role: true },
  });
  const cashierMap = new Map(cashiers.map((c) => [c.id, c]));

  return grouped
    .map((g) => ({
      cashier: cashierMap.get(g.cashierId) ?? { id: g.cashierId, name: "Unknown" },
      orders: g._count,
      revenue: Number(g._sum.totalAmount ?? 0),
      avgOrderValue: Number(g._avg.totalAmount ?? 0),
    }))
    .sort((a, b) => b.revenue - a.revenue);
}

// ─── INVENTORY (stock value) ─────────────────────────
export async function getInventoryReport(businessId: string, branchId?: string) {
  const items = await prisma.inventory.findMany({
    where: {
      businessId,
      ...(branchId ? { branchId } : {}),
      product: { deletedAt: null },
    },
    select: {
      stock: true,
      branchId: true,
      branch: { select: { name: true, code: true } },
      product: { select: { costPrice: true, price: true, lowStockThreshold: true } },
    },
  });

  const byBranch = new Map<
    string,
    { branch: unknown; skus: number; units: number; costValue: number; retailValue: number; lowStockCount: number }
  >();

  for (const item of items) {
    const entry = byBranch.get(item.branchId) ?? {
      branch: { id: item.branchId, ...item.branch },
      skus: 0,
      units: 0,
      costValue: 0,
      retailValue: 0,
      lowStockCount: 0,
    };
    entry.skus += 1;
    entry.units += item.stock;
    entry.costValue += item.stock * Number(item.product.costPrice);
    entry.retailValue += item.stock * Number(item.product.price);
    if (item.stock < item.product.lowStockThreshold) entry.lowStockCount += 1;
    byBranch.set(item.branchId, entry);
  }

  const branches = [...byBranch.values()];
  return {
    branches,
    totals: branches.reduce(
      (acc, b) => ({
        skus: acc.skus + b.skus,
        units: acc.units + b.units,
        costValue: acc.costValue + b.costValue,
        retailValue: acc.retailValue + b.retailValue,
        lowStockCount: acc.lowStockCount + b.lowStockCount,
      }),
      { skus: 0, units: 0, costValue: 0, retailValue: 0, lowStockCount: 0 }
    ),
  };
}

// ─── DASHBOARD EXTRAS (profit, time patterns, category, low stock, target) ──
// One call powering the optional dashboard widgets. COGS is estimated from the
// product's *current* cost price (OrderItem doesn't snapshot cost), so profit is
// an approximation when cost prices change over time.
export async function getDashboardExtras(businessId: string, range: DateRange) {
  const biz = await prisma.business.findFirst({
    where: { id: businessId },
    select: { timezone: true, settings: true },
  });
  const tz = biz?.timezone || "Asia/Dhaka";
  const settings = (biz?.settings as Record<string, unknown> | null) ?? {};
  const salesTarget = Number(settings.salesTarget ?? 0);

  const branchOi = range.branchId ? Prisma.sql`AND o."branchId" = ${range.branchId}` : Prisma.empty;
  const branchO = range.branchId ? Prisma.sql`AND "branchId" = ${range.branchId}` : Prisma.empty;

  const [totals, cogsRows, byHour, byDayHour, byCategory, byBranch] = await Promise.all([
    salesTotals(businessId, range),
    prisma.$queryRaw<{ cogs: number }[]>(Prisma.sql`
      SELECT COALESCE(SUM(oi.quantity * p."costPrice"), 0)::float AS cogs
      FROM "OrderItem" oi
      JOIN "Order" o ON o.id = oi."orderId"
      JOIN "Product" p ON p.id = oi."productId"
      WHERE o."businessId" = ${businessId} AND o.status != 'VOIDED'
        AND o."createdAt" >= ${range.from} AND o."createdAt" <= ${range.to}
        ${branchOi}
    `),
    prisma.$queryRaw<{ hour: number; orders: number; revenue: number }[]>(Prisma.sql`
      SELECT EXTRACT(HOUR FROM "createdAt" AT TIME ZONE ${tz})::int AS hour,
             COUNT(*)::int AS orders,
             COALESCE(SUM("totalAmount"), 0)::float AS revenue
      FROM "Order"
      WHERE "businessId" = ${businessId} AND status != 'VOIDED'
        AND "createdAt" >= ${range.from} AND "createdAt" <= ${range.to}
        ${branchO}
      GROUP BY 1 ORDER BY 1
    `),
    prisma.$queryRaw<{ dow: number; hour: number; revenue: number; orders: number }[]>(Prisma.sql`
      SELECT EXTRACT(DOW FROM "createdAt" AT TIME ZONE ${tz})::int AS dow,
             EXTRACT(HOUR FROM "createdAt" AT TIME ZONE ${tz})::int AS hour,
             COALESCE(SUM("totalAmount"), 0)::float AS revenue,
             COUNT(*)::int AS orders
      FROM "Order"
      WHERE "businessId" = ${businessId} AND status != 'VOIDED'
        AND "createdAt" >= ${range.from} AND "createdAt" <= ${range.to}
        ${branchO}
      GROUP BY 1, 2
    `),
    prisma.$queryRaw<{ category: string; revenue: number; qty: number }[]>(Prisma.sql`
      SELECT c.name AS category,
             COALESCE(SUM(oi.subtotal), 0)::float AS revenue,
             COALESCE(SUM(oi.quantity), 0)::int AS qty
      FROM "OrderItem" oi
      JOIN "Order" o ON o.id = oi."orderId"
      JOIN "ProductCategory" pc ON pc."productId" = oi."productId"
      JOIN "Category" c ON c.id = pc."categoryId"
      WHERE o."businessId" = ${businessId} AND o.status != 'VOIDED'
        AND o."createdAt" >= ${range.from} AND o."createdAt" <= ${range.to}
        ${branchOi}
      GROUP BY c.name ORDER BY revenue DESC
    `),
    getBranchReport(businessId, { from: range.from, to: range.to }),
  ]);

  const netRevenue = totals.netRevenue;
  const cogs = cogsRows[0]?.cogs ?? 0;
  const grossProfit = netRevenue - cogs;

  // Low-stock items (stock summed across branches, or branch-scoped).
  const inv = await prisma.inventory.findMany({
    where: {
      businessId,
      ...(range.branchId ? { branchId: range.branchId } : {}),
      product: { deletedAt: null, isActive: true },
    },
    select: { stock: true, product: { select: { id: true, name: true, lowStockThreshold: true } } },
  });
  const stockByProduct = new Map<string, { name: string; stock: number; threshold: number }>();
  for (const i of inv) {
    const e =
      stockByProduct.get(i.product.id) ??
      { name: i.product.name, stock: 0, threshold: i.product.lowStockThreshold };
    e.stock += i.stock;
    stockByProduct.set(i.product.id, e);
  }
  const lowStock = [...stockByProduct.values()]
    .filter((p) => p.stock < p.threshold)
    .sort((a, b) => a.stock - a.threshold - (b.stock - b.threshold))
    .slice(0, 8);

  // Monthly target — current calendar month net revenue vs the configured goal.
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const monthTotals = await salesTotals(businessId, {
    from: monthStart,
    to: now,
    branchId: range.branchId,
  });
  const daysInMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).getUTCDate();

  return {
    profit: {
      netRevenue,
      cogs,
      grossProfit,
      margin: netRevenue > 0 ? Number(((grossProfit / netRevenue) * 100).toFixed(1)) : 0,
    },
    byHour,
    byDayHour,
    byCategory,
    byBranch,
    lowStock,
    monthlyTarget: {
      target: salesTarget,
      achieved: monthTotals.netRevenue,
      daysLeft: daysInMonth - now.getUTCDate(),
      pct: salesTarget > 0 ? Number(((monthTotals.netRevenue / salesTarget) * 100).toFixed(1)) : 0,
    },
  };
}

// ─── BRANCH COMPARISON ───────────────────────────────
export async function getBranchReport(businessId: string, range: Omit<DateRange, "branchId">) {
  const grouped = await prisma.order.groupBy({
    by: ["branchId"],
    where: orderWhere(businessId, range),
    _count: true,
    _sum: { totalAmount: true },
    _avg: { totalAmount: true },
  });

  const branches = await prisma.branch.findMany({
    where: { businessId, deletedAt: null },
    select: { id: true, name: true, code: true },
  });
  const statsMap = new Map(grouped.map((g) => [g.branchId, g]));

  return branches
    .map((b) => {
      const stats = statsMap.get(b.id);
      return {
        branch: b,
        orders: stats?._count ?? 0,
        revenue: Number(stats?._sum.totalAmount ?? 0),
        avgOrderValue: Number(stats?._avg.totalAmount ?? 0),
      };
    })
    .sort((a, b) => b.revenue - a.revenue);
}
