import crypto from "crypto";
import { prisma } from "../lib/prisma";
import { AuthUser } from "../middlewares/auth.middleware";
import { ApiError } from "../utils/ApiError";
import {
  hashToken,
  refreshTokenExpiryDate,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from "../utils/jwt";
import { comparePassword, hashPassword } from "../utils/password";
import { sendPasswordResetEmail } from "./mailer.service";

const FREE_PLAN_AI_QUERIES_PER_DAY = 5;

interface RegisterInput {
  businessName: string;
  businessType: string;
  businessEmail: string;
  phone?: string;
  ownerName: string;
  ownerEmail: string;
  password: string;
}

interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

function publicUser(user: {
  id: string;
  name: string;
  email: string;
  role: string;
  businessId: string | null;
}) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    businessId: user.businessId,
  };
}

async function issueTokens(user: AuthUser): Promise<TokenPair> {
  const accessToken = signAccessToken(user);
  const refreshToken = signRefreshToken(user.id);

  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(refreshToken),
      expiresAt: refreshTokenExpiryDate(),
    },
  });

  return { accessToken, refreshToken };
}

async function buildAuthUser(userId: string): Promise<AuthUser> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { branches: { select: { branchId: true } } },
  });
  if (!user) throw ApiError.unauthorized();

  return {
    id: user.id,
    businessId: user.businessId,
    role: user.role,
    branchIds: user.branches.map((b) => b.branchId),
  };
}

// ─── REGISTER (business onboarding) ──────────────────
export async function register(input: RegisterInput) {
  const [businessExists, userExists] = await Promise.all([
    prisma.business.findUnique({ where: { email: input.businessEmail } }),
    prisma.user.findUnique({ where: { email: input.ownerEmail } }),
  ]);
  if (businessExists) {
    throw ApiError.conflict("BUSINESS_EXISTS", "A business with this email already exists");
  }
  if (userExists) {
    throw ApiError.conflict("EMAIL_EXISTS", "A user with this email already exists");
  }

  const passwordHash = await hashPassword(input.password);
  const now = new Date();
  const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const { business, owner } = await prisma.$transaction(async (tx) => {
    const business = await tx.business.create({
      data: {
        name: input.businessName,
        type: input.businessType,
        email: input.businessEmail,
        phone: input.phone,
      },
    });

    const branch = await tx.branch.create({
      data: {
        businessId: business.id,
        name: "Main Branch",
        code: "MAIN-01",
        isMainBranch: true,
      },
    });

    const owner = await tx.user.create({
      data: {
        businessId: business.id,
        name: input.ownerName,
        email: input.ownerEmail,
        password: passwordHash,
        role: "OWNER",
        branches: { create: { branchId: branch.id } },
      },
    });

    await tx.subscription.create({
      data: {
        businessId: business.id,
        plan: "FREE",
        aiQueryLimit: FREE_PLAN_AI_QUERIES_PER_DAY,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
      },
    });

    return { business, owner };
  });

  const tokens = await issueTokens(await buildAuthUser(owner.id));
  return {
    user: publicUser(owner),
    business: { id: business.id, name: business.name, type: business.type },
    ...tokens,
  };
}

// ─── LOGIN ───────────────────────────────────────────
export async function login(email: string, password: string) {
  const user = await prisma.user.findUnique({
    where: { email },
    include: { business: { select: { isActive: true, deletedAt: true } } },
  });

  // Same error for unknown email and wrong password — don't leak which.
  const invalid = ApiError.unauthorized("Invalid email or password");
  if (!user || user.deletedAt) throw invalid;
  if (!(await comparePassword(password, user.password))) throw invalid;

  if (!user.isActive) {
    throw ApiError.forbidden("Your account has been deactivated");
  }
  if (user.business && (!user.business.isActive || user.business.deletedAt)) {
    throw ApiError.forbidden("This business account is suspended");
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  const tokens = await issueTokens(await buildAuthUser(user.id));
  return { user: publicUser(user), ...tokens };
}

// ─── REFRESH (with rotation + reuse detection) ───────
export async function refresh(refreshToken: string) {
  let payload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw ApiError.unauthorized("Invalid or expired refresh token");
  }

  const stored = await prisma.refreshToken.findUnique({
    where: { tokenHash: hashToken(refreshToken) },
  });

  if (!stored || stored.expiresAt < new Date()) {
    throw ApiError.unauthorized("Invalid or expired refresh token");
  }

  // A revoked token being replayed means it leaked (or an old client retried).
  // Revoke the whole family for that user as a precaution.
  if (stored.revokedAt) {
    await prisma.refreshToken.updateMany({
      where: { userId: stored.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    throw ApiError.unauthorized("Refresh token reuse detected — please log in again");
  }

  await prisma.refreshToken.update({
    where: { id: stored.id },
    data: { revokedAt: new Date() },
  });

  return issueTokens(await buildAuthUser(payload.sub));
}

// ─── LOGOUT ──────────────────────────────────────────
export async function logout(refreshToken: string | undefined) {
  if (!refreshToken) return;
  await prisma.refreshToken.updateMany({
    where: { tokenHash: hashToken(refreshToken), revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

// ─── CHANGE PASSWORD ─────────────────────────────────
export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string
) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw ApiError.unauthorized();

  if (!(await comparePassword(currentPassword, user.password))) {
    throw ApiError.badRequest("INVALID_PASSWORD", "Current password is incorrect");
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { password: await hashPassword(newPassword) },
    }),
    // Force re-login everywhere else.
    prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
  ]);
}

// ─── FORGOT / RESET PASSWORD ─────────────────────────
export async function forgotPassword(email: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  // Always succeed from the caller's perspective — don't reveal whether the
  // email is registered.
  if (!user || user.deletedAt || !user.isActive) return;

  const token = crypto.randomBytes(32).toString("hex");
  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
    },
  });

  await sendPasswordResetEmail(user.email, token);
}

export async function resetPassword(token: string, newPassword: string) {
  const stored = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(token) },
  });

  if (!stored || stored.usedAt || stored.expiresAt < new Date()) {
    throw ApiError.badRequest("INVALID_RESET_TOKEN", "Reset link is invalid or expired");
  }

  await prisma.$transaction([
    prisma.passwordResetToken.update({
      where: { id: stored.id },
      data: { usedAt: new Date() },
    }),
    prisma.user.update({
      where: { id: stored.userId },
      data: { password: await hashPassword(newPassword) },
    }),
    prisma.refreshToken.updateMany({
      where: { userId: stored.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
  ]);
}
