import crypto from "crypto";
import { PLAN_LIMITS } from "../config/plans";
import { prisma } from "../lib/prisma";
import { ApiError } from "../utils/ApiError";
import { hashToken } from "../utils/jwt";
import { hashPassword } from "../utils/password";
import { buildMeta, ListMeta } from "../utils/response";
import { sendMail } from "./mailer.service";

const userSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  isActive: true,
  lastLoginAt: true,
  createdAt: true,
  branches: {
    select: { branch: { select: { id: true, name: true, code: true } } },
  },
} as const;

function shapeUser<T extends { branches: { branch: unknown }[] }>(user: T) {
  return { ...user, branches: user.branches.map((b) => b.branch) };
}

async function assertUserLimit(businessId: string) {
  const subscription = await prisma.subscription.findUnique({ where: { businessId } });
  const plan = subscription?.plan ?? "FREE";
  const limit = PLAN_LIMITS[plan].users;

  const activeUsers = await prisma.user.count({
    where: { businessId, deletedAt: null, isActive: true },
  });
  if (activeUsers >= limit) {
    throw ApiError.forbidden(
      `Your ${plan} plan allows ${limit} user${limit === 1 ? "" : "s"}. Upgrade to add more team members.`
    );
  }
}

// ─── LIST / GET ──────────────────────────────────────
interface ListOptions {
  page: number;
  limit: number;
  search?: string;
  branchId?: string;
}

export async function listUsers(
  businessId: string,
  opts: ListOptions
): Promise<{ users: unknown[]; meta: ListMeta }> {
  const where = {
    businessId,
    deletedAt: null,
    ...(opts.branchId ? { branches: { some: { branchId: opts.branchId } } } : {}),
    ...(opts.search
      ? {
          OR: [
            { name: { contains: opts.search, mode: "insensitive" as const } },
            { email: { contains: opts.search, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: userSelect,
      orderBy: { createdAt: "asc" },
      skip: (opts.page - 1) * opts.limit,
      take: opts.limit,
    }),
    prisma.user.count({ where }),
  ]);

  return { users: users.map(shapeUser), meta: buildMeta(total, opts.page, opts.limit) };
}

export async function getUser(businessId: string, id: string) {
  const user = await prisma.user.findFirst({
    where: { id, businessId, deletedAt: null },
    select: userSelect,
  });
  if (!user) throw ApiError.notFound("User not found");
  return shapeUser(user);
}

// ─── INVITE ──────────────────────────────────────────
interface InviteInput {
  name: string;
  email: string;
  role: "MANAGER" | "CASHIER";
  branchIds: string[];
}

export async function inviteUser(businessId: string, input: InviteInput) {
  await assertUserLimit(businessId);

  const emailTaken = await prisma.user.findUnique({ where: { email: input.email } });
  if (emailTaken) {
    throw ApiError.conflict("EMAIL_EXISTS", "A user with this email already exists");
  }

  const branches = await prisma.branch.findMany({
    where: { id: { in: input.branchIds }, businessId, deletedAt: null },
  });
  if (branches.length !== input.branchIds.length) {
    throw ApiError.badRequest("INVALID_BRANCH", "One or more branches do not exist");
  }

  // The invitee never receives this placeholder password — they set their own
  // through the invite link (same flow as password reset).
  const placeholderPassword = await hashPassword(crypto.randomBytes(32).toString("hex"));

  const user = await prisma.user.create({
    data: {
      businessId,
      name: input.name,
      email: input.email,
      password: placeholderPassword,
      role: input.role,
      branches: { create: input.branchIds.map((branchId) => ({ branchId })) },
    },
    select: userSelect,
  });

  const inviteToken = crypto.randomBytes(32).toString("hex");
  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(inviteToken),
      expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000), // 72 hours
    },
  });

  const inviteUrl = `${process.env.FRONTEND_URL ?? "http://localhost:3000"}/accept-invite?token=${inviteToken}`;
  await sendMail({
    to: user.email,
    subject: "You've been invited to Smart POS",
    text: `${input.name}, you've been added to a Smart POS team as ${input.role}.\nSet your password to get started (link valid for 72 hours):\n\n${inviteUrl}`,
  });

  return shapeUser(user);
}

// ─── UPDATE ──────────────────────────────────────────
interface UpdateUserInput {
  name?: string;
  role?: "MANAGER" | "CASHIER";
  branchIds?: string[];
}

export async function updateUser(
  businessId: string,
  id: string,
  callerId: string,
  input: UpdateUserInput
) {
  const target = await prisma.user.findFirst({
    where: { id, businessId, deletedAt: null },
  });
  if (!target) throw ApiError.notFound("User not found");
  if (target.role === "OWNER") {
    throw ApiError.forbidden("The owner account cannot be modified here");
  }
  if (id === callerId && input.role) {
    throw ApiError.forbidden("You cannot change your own role");
  }

  if (input.branchIds) {
    const branches = await prisma.branch.findMany({
      where: { id: { in: input.branchIds }, businessId, deletedAt: null },
    });
    if (branches.length !== input.branchIds.length) {
      throw ApiError.badRequest("INVALID_BRANCH", "One or more branches do not exist");
    }
  }

  const user = await prisma.user.update({
    where: { id },
    data: {
      ...(input.name ? { name: input.name } : {}),
      ...(input.role ? { role: input.role } : {}),
      ...(input.branchIds
        ? {
            branches: {
              deleteMany: {},
              create: input.branchIds.map((branchId) => ({ branchId })),
            },
          }
        : {}),
    },
    select: userSelect,
  });

  return shapeUser(user);
}

// ─── DEACTIVATE / REACTIVATE ─────────────────────────
export async function deactivateUser(businessId: string, id: string, callerId: string) {
  const target = await prisma.user.findFirst({
    where: { id, businessId, deletedAt: null },
  });
  if (!target) throw ApiError.notFound("User not found");
  if (target.role === "OWNER") throw ApiError.forbidden("The owner account cannot be removed");
  if (id === callerId) throw ApiError.forbidden("You cannot remove your own account");

  await prisma.$transaction([
    prisma.user.update({
      where: { id },
      data: { isActive: false, deletedAt: new Date() },
    }),
    prisma.refreshToken.updateMany({
      where: { userId: id, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
  ]);
}

export async function reactivateUser(businessId: string, id: string) {
  const target = await prisma.user.findFirst({ where: { id, businessId } });
  if (!target) throw ApiError.notFound("User not found");
  if (target.isActive && !target.deletedAt) return getUser(businessId, id);

  await assertUserLimit(businessId);

  const user = await prisma.user.update({
    where: { id },
    data: { isActive: true, deletedAt: null },
    select: userSelect,
  });
  return shapeUser(user);
}

// ─── ME ──────────────────────────────────────────────
export async function getMe(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      ...userSelect,
      business: { select: { id: true, name: true, type: true, currency: true, timezone: true } },
    },
  });
  if (!user) throw ApiError.unauthorized();
  return shapeUser(user);
}

export async function updateMe(userId: string, input: { name: string }) {
  const user = await prisma.user.update({
    where: { id: userId },
    data: { name: input.name },
    select: userSelect,
  });
  return shapeUser(user);
}
