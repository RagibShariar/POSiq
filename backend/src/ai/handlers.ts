import { prisma } from "../lib/prisma";
import * as reportService from "../services/report.service";

// Tool handlers for the AI agent. Every query is scoped to the caller's
// businessId — the model can only ever see the tenant's own data. Handlers
// return plain JSON-serializable objects that go back to Claude as tool results.

interface ToolContext {
  businessId: string;
  // When the caller restricts the conversation to one branch, tools ignore
  // any branchId the model picks and use this one.
  branchId?: string;
}

function parseRange(input: { from?: string; to?: string }) {
  const to = input.to ? new Date(input.to + "T23:59:59.999Z") : new Date();
  const from = input.from
    ? new Date(input.from + "T00:00:00Z")
    : new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);
  return { from, to };
}

async function getSalesSummary(ctx: ToolContext, input: { from?: string; to?: string; branchId?: string }) {
  const { from, to } = parseRange(input);
  const branchId = ctx.branchId ?? input.branchId;
  return reportService.getSalesReport(ctx.businessId, { from, to, branchId });
}

async function getTopProducts(
  ctx: ToolContext,
  input: { limit?: number; from?: string; to?: string; branchId?: string }
) {
  const { from, to } = parseRange(input);
  const branchId = ctx.branchId ?? input.branchId;
  const limit = Math.min(25, Math.max(1, input.limit ?? 10));
  return reportService.getProductReport(ctx.businessId, { from, to, branchId }, limit);
}

async function getLowStockItems(ctx: ToolContext, input: { branchId?: string }) {
  const branchId = ctx.branchId ?? input.branchId;

  const items = await prisma.inventory.findMany({
    where: {
      businessId: ctx.businessId,
      ...(branchId ? { branchId } : {}),
      product: { deletedAt: null, isActive: true },
    },
    select: {
      stock: true,
      branch: { select: { name: true, code: true } },
      product: { select: { name: true, sku: true, unit: true, lowStockThreshold: true } },
    },
  });

  return items
    .filter((i) => i.stock < i.product.lowStockThreshold)
    .map((i) => ({
      product: i.product.name,
      sku: i.product.sku,
      branch: `${i.branch.name} (${i.branch.code})`,
      stock: i.stock,
      unit: i.product.unit,
      threshold: i.product.lowStockThreshold,
    }));
}

async function getReorderSuggestions(ctx: ToolContext, input: { branchId?: string }) {
  const branchId = ctx.branchId ?? input.branchId;
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  // Sales velocity per product over the last 30 days
  const sold = await prisma.orderItem.groupBy({
    by: ["productId"],
    where: {
      order: {
        businessId: ctx.businessId,
        status: { not: "VOIDED" },
        createdAt: { gte: since },
        ...(branchId ? { branchId } : {}),
      },
    },
    _sum: { quantity: true },
  });
  const velocity = new Map(sold.map((s) => [s.productId, (s._sum.quantity ?? 0) / 30]));

  const inventory = await prisma.inventory.findMany({
    where: {
      businessId: ctx.businessId,
      ...(branchId ? { branchId } : {}),
      product: { deletedAt: null, isActive: true },
    },
    select: {
      stock: true,
      productId: true,
      branch: { select: { name: true, code: true } },
      product: { select: { name: true, sku: true, unit: true, lowStockThreshold: true } },
    },
  });

  const suggestions = inventory
    .map((inv) => {
      const perDay = velocity.get(inv.productId) ?? 0;
      const daysOfStockLeft = perDay > 0 ? inv.stock / perDay : null;
      return {
        product: inv.product.name,
        sku: inv.product.sku,
        branch: `${inv.branch.name} (${inv.branch.code})`,
        currentStock: inv.stock,
        unit: inv.product.unit,
        soldPerDay: Number(perDay.toFixed(2)),
        daysOfStockLeft: daysOfStockLeft === null ? null : Number(daysOfStockLeft.toFixed(1)),
        suggestedReorderQty: perDay > 0 ? Math.ceil(perDay * 14) : null, // 2 weeks of cover
      };
    })
    .filter(
      (s) =>
        (s.daysOfStockLeft !== null && s.daysOfStockLeft < 7) ||
        s.currentStock < (inventory.find((i) => i.product.sku === s.sku)?.product.lowStockThreshold ?? 0)
    )
    .sort((a, b) => (a.daysOfStockLeft ?? Infinity) - (b.daysOfStockLeft ?? Infinity));

  return suggestions;
}

async function compareBranchPerformance(ctx: ToolContext, input: { from?: string; to?: string }) {
  const { from, to } = parseRange(input);
  return reportService.getBranchReport(ctx.businessId, { from, to });
}

type Handler = (ctx: ToolContext, input: never) => Promise<unknown>;

const handlers: Record<string, Handler> = {
  get_sales_summary: getSalesSummary,
  get_top_products: getTopProducts,
  get_low_stock_items: getLowStockItems,
  get_reorder_suggestions: getReorderSuggestions,
  compare_branch_performance: compareBranchPerformance,
};

export async function executeTool(
  name: string,
  ctx: ToolContext,
  input: Record<string, unknown>
): Promise<unknown> {
  const handler = handlers[name];
  if (!handler) {
    return { error: `Unknown tool: ${name}` };
  }
  return handler(ctx, input as never);
}
