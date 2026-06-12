import { PlanType } from "@prisma/client";
import { PLAN_LIMITS, PLAN_PRICES } from "../config/plans";
import { prisma } from "../lib/prisma";
import { ApiError } from "../utils/ApiError";
import { buildMeta } from "../utils/response";
import { sendMail } from "./mailer.service";

function serializeLimits(plan: PlanType) {
  const limits = PLAN_LIMITS[plan];
  const nullIfInfinite = (n: number) => (n === Infinity ? null : n);
  return {
    users: nullIfInfinite(limits.users),
    products: nullIfInfinite(limits.products),
    aiQueriesPerDay: nullIfInfinite(limits.aiQueriesPerDay),
  };
}

export async function getSubscription(businessId: string) {
  const subscription = await prisma.subscription.findUnique({ where: { businessId } });
  if (!subscription) throw ApiError.notFound("Subscription not found");

  const [users, products, aiToday] = await Promise.all([
    prisma.user.count({ where: { businessId, deletedAt: null, isActive: true } }),
    prisma.product.count({ where: { businessId, deletedAt: null } }),
    prisma.aiQueryLog.count({
      where: {
        businessId,
        createdAt: { gte: new Date(new Date().setUTCHours(0, 0, 0, 0)) },
      },
    }),
  ]);

  return {
    plan: subscription.plan,
    status: subscription.status,
    currentPeriodStart: subscription.currentPeriodStart,
    currentPeriodEnd: subscription.currentPeriodEnd,
    monthlyPrice: PLAN_PRICES[subscription.plan],
    limits: serializeLimits(subscription.plan),
    usage: { users, products, aiQueriesToday: aiToday },
  };
}

export async function upgrade(businessId: string, plan: PlanType) {
  if (plan === "ENTERPRISE") {
    throw ApiError.badRequest(
      "CONTACT_SALES",
      "Enterprise plans are set up manually — contact sales."
    );
  }

  const subscription = await prisma.subscription.findUnique({
    where: { businessId },
    include: { business: { select: { name: true, email: true } } },
  });
  if (!subscription) throw ApiError.notFound("Subscription not found");
  if (subscription.plan === plan && subscription.status === "ACTIVE") {
    throw ApiError.badRequest("ALREADY_ON_PLAN", `You are already on the ${plan} plan`);
  }

  const now = new Date();
  const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const limits = PLAN_LIMITS[plan];

  const [updated] = await prisma.$transaction([
    prisma.subscription.update({
      where: { businessId },
      data: {
        plan,
        status: "ACTIVE",
        aiQueryLimit: limits.aiQueriesPerDay === Infinity ? 999999 : limits.aiQueriesPerDay,
        aiQueryUsed: 0,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
      },
    }),
    prisma.billingRecord.create({
      data: {
        businessId,
        plan,
        amount: PLAN_PRICES[plan],
        periodStart: now,
        periodEnd,
        note: `Plan changed from ${subscription.plan} to ${plan}`,
      },
    }),
  ]);

  await sendMail({
    to: subscription.business.email,
    subject: `Smart POS — plan changed to ${plan}`,
    text: `Hi ${subscription.business.name},\n\nYour subscription is now on the ${plan} plan (${PLAN_PRICES[plan]} BDT/month), valid until ${periodEnd.toISOString().slice(0, 10)}.`,
  });

  return { plan: updated.plan, status: updated.status, currentPeriodEnd: updated.currentPeriodEnd };
}

// Cancelling keeps the paid plan until the period ends; it just stops renewal.
export async function cancel(businessId: string) {
  const subscription = await prisma.subscription.findUnique({ where: { businessId } });
  if (!subscription) throw ApiError.notFound("Subscription not found");
  if (subscription.plan === "FREE") {
    throw ApiError.badRequest("NOTHING_TO_CANCEL", "The FREE plan cannot be cancelled");
  }
  if (subscription.status === "CANCELLED") {
    throw ApiError.badRequest("ALREADY_CANCELLED", "Subscription is already cancelled");
  }

  const updated = await prisma.subscription.update({
    where: { businessId },
    data: { status: "CANCELLED" },
  });

  return {
    plan: updated.plan,
    status: updated.status,
    activeUntil: updated.currentPeriodEnd,
    message: `Your ${updated.plan} plan stays active until ${updated.currentPeriodEnd.toISOString().slice(0, 10)}, then reverts to FREE.`,
  };
}

export async function listInvoices(businessId: string, opts: { page: number; limit: number }) {
  const [invoices, total] = await Promise.all([
    prisma.billingRecord.findMany({
      where: { businessId },
      orderBy: { createdAt: "desc" },
      skip: (opts.page - 1) * opts.limit,
      take: opts.limit,
    }),
    prisma.billingRecord.count({ where: { businessId } }),
  ]);

  return { invoices, meta: buildMeta(total, opts.page, opts.limit) };
}
