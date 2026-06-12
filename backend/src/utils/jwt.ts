import crypto from "crypto";
import jwt, { SignOptions } from "jsonwebtoken";
import { env } from "../config/env";
import { AuthUser } from "../middlewares/auth.middleware";

export interface RefreshPayload {
  sub: string; // user id
  jti: string; // unique id so every refresh token hashes differently
}

export function signAccessToken(user: AuthUser): string {
  return jwt.sign(user, env.jwt.accessSecret, {
    expiresIn: env.jwt.accessExpiresIn as SignOptions["expiresIn"],
  });
}

export function signRefreshToken(userId: string): string {
  const payload: RefreshPayload = { sub: userId, jti: crypto.randomUUID() };
  return jwt.sign(payload, env.jwt.refreshSecret, {
    expiresIn: env.jwt.refreshExpiresIn as SignOptions["expiresIn"],
  });
}

export function verifyRefreshToken(token: string): RefreshPayload {
  return jwt.verify(token, env.jwt.refreshSecret) as RefreshPayload;
}

// Tokens are stored hashed so a DB leak doesn't expose usable credentials.
export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function refreshTokenExpiryDate(): Date {
  // Mirrors JWT_REFRESH_EXPIRES_IN; only supports the "Nd" day format we use.
  const days = Number(env.jwt.refreshExpiresIn.replace(/\D/g, "")) || 7;
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}
