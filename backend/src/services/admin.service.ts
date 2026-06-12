import { prisma } from "../lib/prisma";
import { ApiError } from "../utils/ApiError";
import { signAccessToken } from "../utils/jwt";
import { buildMeta, ListMeta } from "../utils/response";

// ─── BUSINESSES ──────────────────────────────────────
interface ListOptions {
  page: number;
  limit: number;
  search?: string;
  plan?: string;
  includeInactive?: boolean;
}

export async function listBusinesses(
  opts: ListOptions
): Promise<{ businesses: unknown[]; meta: ListMeta }> {
  const where = {
    ...(opts.includeInactive ? {} : { deletedAt: null }),
    ...(opts.plan ? { subscription: { plan: opts.plan as never } } : {}),
    ...(opts.search
      ? {
          OR: [
            { name: { contains: opts.search, mode: "insensitive" as const } },
            { email: { contains: opts.search, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [businesses, total] = await Promise.all([
    prisma.business.findMany({
      where,
      select: {
        id: true,
        name: true,
        type: true,
        email: true,
        isActive: true,
        createdAt: true,
        deletedAt: true,
        subscription: { select: { plan: true, status: true, currentPeriodEnd: true } },
        _count: { select: { users: true, branches: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (opts.page - 1) * opts.limit,
      take: opts.limit,
    }),
    prisma.business.count({ where }),
  ]);

  return { businesses, meta: buildMeta(total, opts.page, opts.limit) };
}

export async function getBusinessDetail(id: string) {
  const business = await prisma.business.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      type: true,
      email: true,
      phone: true,
      address: true,
      currency: true,
      timezone: true,
      isActive: true,
      createdAt: true,
      deletedAt: true,
      subscription: true,
      branches: {
        select: { id: true, name: true, code: true, isActive: true, isMainBranch: true },
      },
      users: {
        where: { deletedAt: null },
        select: { id: true, name: true, email: true, role: true, isActive: true, lastLoginAt: true },
      },
      _count: { select: { products: true } },
    },
  });
  if (!business) throw ApiError.notFound("Business not found");

  const [orderStats, aiStats] = await Promise.all([
    prisma.order.aggregate({
      where: { businessId: id, status: { not: "VOIDED" } },
      _count: true,
      _sum: { totalAmount: true },
    }),
    prisma.aiQueryLog.aggregate({
      where: { businessId: id },
      _count: true,
      _sum: { tokensUsed: true, costUsd: true },
    }),
  ]);

  return {
    ...business,
    stats: {
      orders: orderStats._count,
      grossRevenue: Number(orderStats._sum.totalAmount ?? 0),
      aiQueries: aiStats._count,
      aiTokens: aiStats._sum.tokensUsed ?? 0,
      aiCostUsd: Number(aiStats._sum.costUsd ?? 0),
    },
  };
}

export async function updateBusiness(id: string, input: { isActive?: boolean; name?: string }) {
  const business = await prisma.business.findUnique({ where: { id } });
  if (!business) throw ApiError.notFound("Business not found");

  return prisma.business.update({
    where: { id },
    data: input,
    select: { id: true, name: true, isActive: true },
  });
}

export async function suspendBusiness(id: string, suspend: boolean) {
  const business = await prisma.business.findUnique({ where: { id } });
  if (!business) throw ApiError.notFound("Business not found");

  const updated = await prisma.business.update({
    where: { id },
    data: { isActive: !suspend },
    select: { id: true, name: true, isActive: true },
  });

  if (suspend) {
    // Kill all active sessions for the business's users
    const users = await prisma.user.findMany({ where: { businessId: id }, select: { id: true } });
    await prisma.refreshToken.updateMany({
      where: { userId: { in: users.map((u) => u.id) }, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  return updated;
}

// ─── PLATFORM STATS ──────────────────────────────────
export async function getStats() {
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);

  const [businesses, byPlan, users, orders, ordersThisMonth, ai] = await Promise.all([
    prisma.business.count({ where: { deletedAt: null } }),
    prisma.subscription.groupBy({
      by: ["plan"],
      where: { business: { deletedAt: null } },
      _count: true,
    }),
    prisma.user.count({ where: { deletedAt: null, businessId: { not: null } } }),
    prisma.order.aggregate({
      where: { status: { not: "VOIDED" } },
      _count: true,
      _sum: { totalAmount: true },
    }),
    prisma.order.aggregate({
      where: { status: { not: "VOIDED" }, createdAt: { gte: monthStart } },
      _count: true,
      _sum: { totalAmount: true },
    }),
    prisma.aiQueryLog.aggregate({
      _count: true,
      _sum: { tokensUsed: true, costUsd: true },
    }),
  ]);

  return {
    businesses: {
      total: businesses,
      byPlan: Object.fromEntries(byPlan.map((p) => [p.plan, p._count])),
    },
    users,
    orders: {
      allTime: { count: orders._count, value: Number(orders._sum.totalAmount ?? 0) },
      thisMonth: {
        count: ordersThisMonth._count,
        value: Number(ordersThisMonth._sum.totalAmount ?? 0),
      },
    },
    ai: {
      queries: ai._count,
      tokens: ai._sum.tokensUsed ?? 0,
      costUsd: Number(ai._sum.costUsd ?? 0),
    },
  };
}

// ─── AI USAGE (per business) ─────────────────────────
export async function getAiUsage(opts: { page: number; limit: number }) {
  const grouped = await prisma.aiQueryLog.groupBy({
    by: ["businessId"],
    _count: true,
    _sum: { tokensUsed: true, costUsd: true },
    orderBy: { _sum: { tokensUsed: "desc" } },
    skip: (opts.page - 1) * opts.limit,
    take: opts.limit,
  });

  const businesses = await prisma.business.findMany({
    where: { id: { in: grouped.map((g) => g.businessId) } },
    select: { id: true, name: true, subscription: { select: { plan: true } } },
  });
  const bizMap = new Map(businesses.map((b) => [b.id, b]));

  return grouped.map((g) => ({
    business: bizMap.get(g.businessId) ?? { id: g.businessId, name: "(deleted)" },
    queries: g._count,
    tokens: g._sum.tokensUsed ?? 0,
    costUsd: Number(g._sum.costUsd ?? 0),
  }));
}

// ─── IMPERSONATE ─────────────────────────────────────
// Issues a short-lived access token for the business's owner so support can
// see exactly what the customer sees. Refresh tokens are NOT issued.
export async function impersonate(businessId: string) {
  const owner = await prisma.user.findFirst({
    where: { businessId, role: "OWNER", deletedAt: null },
    include: { branches: { select: { branchId: true } } },
  });
  if (!owner) throw ApiError.notFound("No owner account found for this business");

  const accessToken = signAccessToken({
    id: owner.id,
    businessId: owner.businessId,
    role: owner.role,
    branchIds: owner.branches.map((b) => b.branchId),
  });

  return {
    accessToken,
    user: { id: owner.id, name: owner.name, email: owner.email },
    note: "Access token only (15 min). No refresh token issued for impersonation sessions.",
  };
}
