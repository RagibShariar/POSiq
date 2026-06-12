import { prisma } from "../lib/prisma";
import { ApiError } from "../utils/ApiError";
import { buildMeta, ListMeta } from "../utils/response";

interface ListOptions {
  page: number;
  limit: number;
  search?: string;
}

interface BranchInput {
  name: string;
  code: string;
  address?: string;
  phone?: string;
}

const branchSelect = {
  id: true,
  name: true,
  code: true,
  address: true,
  phone: true,
  isActive: true,
  isMainBranch: true,
  createdAt: true,
} as const;

export async function listBranches(
  businessId: string,
  opts: ListOptions
): Promise<{ branches: unknown[]; meta: ListMeta }> {
  const where = {
    businessId,
    deletedAt: null,
    ...(opts.search
      ? {
          OR: [
            { name: { contains: opts.search, mode: "insensitive" as const } },
            { code: { contains: opts.search, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [branches, total] = await Promise.all([
    prisma.branch.findMany({
      where,
      select: { ...branchSelect, _count: { select: { staff: true } } },
      orderBy: [{ isMainBranch: "desc" }, { createdAt: "asc" }],
      skip: (opts.page - 1) * opts.limit,
      take: opts.limit,
    }),
    prisma.branch.count({ where }),
  ]);

  return { branches, meta: buildMeta(total, opts.page, opts.limit) };
}

export async function getBranch(businessId: string, id: string) {
  const branch = await prisma.branch.findFirst({
    where: { id, businessId, deletedAt: null },
    select: { ...branchSelect, _count: { select: { staff: true } } },
  });
  if (!branch) throw ApiError.notFound("Branch not found");
  return branch;
}

export async function createBranch(businessId: string, input: BranchInput) {
  const codeTaken = await prisma.branch.findFirst({
    where: { businessId, code: input.code, deletedAt: null },
  });
  if (codeTaken) {
    throw ApiError.conflict("BRANCH_CODE_EXISTS", `Branch code "${input.code}" is already in use`);
  }

  return prisma.branch.create({
    data: { businessId, ...input },
    select: branchSelect,
  });
}

export async function updateBranch(businessId: string, id: string, input: Partial<BranchInput> & { isActive?: boolean }) {
  await getBranch(businessId, id);

  if (input.code) {
    const codeTaken = await prisma.branch.findFirst({
      where: { businessId, code: input.code, deletedAt: null, NOT: { id } },
    });
    if (codeTaken) {
      throw ApiError.conflict("BRANCH_CODE_EXISTS", `Branch code "${input.code}" is already in use`);
    }
  }

  return prisma.branch.update({
    where: { id },
    data: input,
    select: branchSelect,
  });
}

export async function deleteBranch(businessId: string, id: string) {
  const branch = await getBranch(businessId, id);
  if (branch.isMainBranch) {
    throw ApiError.badRequest("CANNOT_DELETE_MAIN", "The main branch cannot be deleted");
  }

  await prisma.$transaction([
    prisma.branch.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    }),
    prisma.userBranch.deleteMany({ where: { branchId: id } }),
  ]);
}

// ─── STAFF ASSIGNMENT ────────────────────────────────
export async function listStaff(businessId: string, branchId: string) {
  await getBranch(businessId, branchId);

  const assignments = await prisma.userBranch.findMany({
    where: { branchId, user: { deletedAt: null } },
    select: {
      assignedAt: true,
      user: {
        select: { id: true, name: true, email: true, role: true, isActive: true },
      },
    },
    orderBy: { assignedAt: "asc" },
  });

  return assignments.map((a) => ({ ...a.user, assignedAt: a.assignedAt }));
}

export async function assignStaff(businessId: string, branchId: string, userId: string) {
  await getBranch(businessId, branchId);

  const user = await prisma.user.findFirst({
    where: { id: userId, businessId, deletedAt: null },
  });
  if (!user) throw ApiError.notFound("User not found in this business");

  await prisma.userBranch.upsert({
    where: { userId_branchId: { userId, branchId } },
    update: {},
    create: { userId, branchId },
  });
}

export async function unassignStaff(businessId: string, branchId: string, userId: string) {
  await getBranch(businessId, branchId);

  const deleted = await prisma.userBranch.deleteMany({
    where: { userId, branchId, user: { businessId } },
  });
  if (deleted.count === 0) {
    throw ApiError.notFound("This user is not assigned to this branch");
  }
}
