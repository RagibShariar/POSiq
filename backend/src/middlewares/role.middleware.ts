import { NextFunction, Request, Response } from "express";
import { ApiError } from "../utils/ApiError";
import { AuthUser } from "./auth.middleware";

type Role = AuthUser["role"];

// Usage: router.post("/", authenticate, requireRole("OWNER", "MANAGER"), handler)
export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(ApiError.unauthorized());
    // SUPER_ADMIN bypasses all role checks
    if (req.user.role === "SUPER_ADMIN") return next();
    if (!roles.includes(req.user.role)) return next(ApiError.forbidden());
    next();
  };
}
