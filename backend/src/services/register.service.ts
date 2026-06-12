import { prisma } from "../lib/prisma";
import { ApiError } from "../utils/ApiError";
import { buildMeta } from "../utils/response";

const registerSelect = {
  id: true,
  branchId: true,
  openedBy: true,
  closedBy: true,
  openingBalance: true,
  closingBalance: true,
  status: true,
  openedAt: true,
  closedAt: true,
} as const;

async function assertBranchOwnership(businessId: string, branchId: string) {
  const branch = await prisma.branch.findFirst({ where: { id: branchId, businessId, deletedAt: null } });
  if (!branch) throw ApiError.notFound("Branch not found");
  return branch;
}

export async function getOpenRegister(businessId: string, branchId: string) {
  await assertBranchOwnership(businessId, branchId);

  const register = await prisma.cashRegister.findFirst({
    where: { branchId, status: "OPEN" },
    select: registerSelect,
  });
  // Return null (not 404) — callers decide whether to require one.
  return register;
}

export async function openRegister(
  businessId: string,
  branchId: string,
  openedBy: string,
  openingBalance: number
) {
  await assertBranchOwnership(businessId, branchId);

  const existing = await prisma.cashRegister.findFirst({
    where: { branchId, status: "OPEN" },
  });
  if (existing) {
    throw ApiError.conflict("REGISTER_ALREADY_OPEN", "A register is already open for this branch");
  }

  return prisma.cashRegister.create({
    data: { branchId, openedBy, openingBalance },
    select: registerSelect,
  });
}

export async function closeRegister(
  businessId: string,
  branchId: string,
  closedBy: string,
  closingBalance: number
) {
  await assertBranchOwnership(businessId, branchId);

  const register = await prisma.cashRegister.findFirst({
    where: { branchId, status: "OPEN" },
    include: {
      _count: { select: { orders: true } },
      orders: {
        where: { status: { not: "VOIDED" } },
        select: { totalAmount: true, paymentMethod: true },
      },
    },
  });
  if (!register) throw ApiError.badRequest("NO_OPEN_REGISTER", "No open register for this branch");

  const totalSales = register.orders.reduce(
    (sum, o) => sum + Number(o.totalAmount),
    0
  );
  const cashSales = register.orders
    .filter((o) => o.paymentMethod === "CASH" || o.paymentMethod === "MIXED")
    .reduce((sum, o) => sum + Number(o.totalAmount), 0);

  const closed = await prisma.cashRegister.update({
    where: { id: register.id },
    data: { status: "CLOSED", closedBy, closingBalance, closedAt: new Date() },
    select: registerSelect,
  });

  return {
    ...closed,
    summary: {
      totalOrders: register._count.orders,
      totalSales,
      cashSales,
      expectedCash: Number(register.openingBalance) + cashSales,
      closingBalance,
      variance: closingBalance - (Number(register.openingBalance) + cashSales),
    },
  };
}

export async function getHistory(
  businessId: string,
  branchId: string,
  opts: { page: number; limit: number }
) {
  await assertBranchOwnership(businessId, branchId);

  const [registers, total] = await Promise.all([
    prisma.cashRegister.findMany({
      where: { branchId },
      select: registerSelect,
      orderBy: { openedAt: "desc" },
      skip: (opts.page - 1) * opts.limit,
      take: opts.limit,
    }),
    prisma.cashRegister.count({ where: { branchId } }),
  ]);

  return { registers, meta: buildMeta(total, opts.page, opts.limit) };
}
