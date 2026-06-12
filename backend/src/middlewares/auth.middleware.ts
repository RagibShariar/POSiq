import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { ApiError } from "../utils/ApiError";

export interface AuthUser {
  id: string;
  businessId: string | null;
  role: "SUPER_ADMIN" | "OWNER" | "MANAGER" | "CASHIER";
  branchIds: string[];
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function authenticate(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return next(ApiError.unauthorized());
  }

  try {
    const payload = jwt.verify(header.slice(7), env.jwt.accessSecret) as AuthUser;
    req.user = payload;
    next();
  } catch {
    next(ApiError.unauthorized("Invalid or expired token"));
  }
}
