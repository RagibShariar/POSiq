import { NextFunction, Request, Response } from "express";
import { ApiError } from "../utils/ApiError";

// Ensures every tenant-scoped request is pinned to the caller's business.
// Services must always filter queries by req.user.businessId.
export function tenantIsolation(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) return next(ApiError.unauthorized());
  if (req.user.role === "SUPER_ADMIN") return next();
  if (!req.user.businessId) {
    return next(ApiError.forbidden("No business associated with this account"));
  }
  next();
}

// Restricts branch-scoped access: MANAGER/CASHIER may only touch branches
// they are assigned to (branchIds claim from the JWT).
export function requireBranchAccess(paramName = "branchId") {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(ApiError.unauthorized());
    if (req.user.role === "SUPER_ADMIN" || req.user.role === "OWNER") return next();

    const branchId =
      (req.params[paramName] as string | undefined) ??
      (req.query[paramName] as string | undefined) ??
      (req.body?.[paramName] as string | undefined);

    if (branchId && !req.user.branchIds.includes(branchId)) {
      return next(ApiError.forbidden("You are not assigned to this branch"));
    }
    next();
  };
}
