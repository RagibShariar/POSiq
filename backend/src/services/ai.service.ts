import { PLAN_LIMITS } from "../config/plans";
import { prisma } from "../lib/prisma";
import { runAgent } from "../ai/agent";
import { ApiError } from "../utils/ApiError";
import { buildMeta, ListMeta } from "../utils/response";

function todayStart(): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

async function getDailyUsage(businessId: string) {
  const subscription = await prisma.subscription.findUnique({ where: { businessId } });
  const plan = subscription?.plan ?? "FREE";
  const limit = PLAN_LIMITS[plan].aiQueriesPerDay;

  const usedToday = await prisma.aiQueryLog.count({
    where: { businessId, createdAt: { gte: todayStart() } },
  });

  return { plan, limit, usedToday };
}

export async function query(
  businessId: string,
  userId: string,
  question: string,
  branchId?: string
) {
  const { plan, limit, usedToday } = await getDailyUsage(businessId);
  if (usedToday >= limit) {
    throw ApiError.forbidden(
      `Daily AI query limit reached (${limit}/day on the ${plan} plan). Upgrade for more queries.`
    );
  }

  if (branchId) {
    const branch = await prisma.branch.findFirst({
      where: { id: branchId, businessId, deletedAt: null },
    });
    if (!branch) throw ApiError.notFound("Branch not found");
  }

  const result = await runAgent(businessId, question, branchId);

  await prisma.aiQueryLog.create({
    data: {
      businessId,
      branchId,
      userId,
      question,
      response: result.answer,
      tokensUsed: result.tokensUsed,
      costUsd: result.costUsd,
    },
  });

  return {
    answer: result.answer,
    toolsCalled: result.toolsCalled,
    usage: { usedToday: usedToday + 1, limit: limit === Infinity ? null : limit },
  };
}

export async function getHistory(
  businessId: string,
  opts: { page: number; limit: number }
): Promise<{ history: unknown[]; meta: ListMeta }> {
  const [history, total] = await Promise.all([
    prisma.aiQueryLog.findMany({
      where: { businessId },
      select: {
        id: true,
        question: true,
        response: true,
        branchId: true,
        userId: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      skip: (opts.page - 1) * opts.limit,
      take: opts.limit,
    }),
    prisma.aiQueryLog.count({ where: { businessId } }),
  ]);

  return { history, meta: buildMeta(total, opts.page, opts.limit) };
}

export async function clearHistory(businessId: string) {
  await prisma.aiQueryLog.deleteMany({ where: { businessId } });
}

export async function getUsage(businessId: string) {
  const { plan, limit, usedToday } = await getDailyUsage(businessId);

  const thisMonth = new Date();
  thisMonth.setUTCDate(1);
  thisMonth.setUTCHours(0, 0, 0, 0);

  const monthly = await prisma.aiQueryLog.aggregate({
    where: { businessId, createdAt: { gte: thisMonth } },
    _count: true,
    _sum: { tokensUsed: true },
  });

  return {
    plan,
    today: { used: usedToday, limit: limit === Infinity ? null : limit },
    thisMonth: {
      queries: monthly._count,
      tokensUsed: monthly._sum.tokensUsed ?? 0,
    },
  };
}
