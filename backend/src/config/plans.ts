import { PlanType } from "@prisma/client";

// Section 3 of the project plan. Infinity = unlimited.
export interface PlanLimits {
  users: number;
  products: number;
  aiQueriesPerDay: number;
}

export const PLAN_LIMITS: Record<PlanType, PlanLimits> = {
  FREE: { users: 1, products: 100, aiQueriesPerDay: 5 },
  STARTER: { users: 3, products: 500, aiQueriesPerDay: 50 },
  PRO: { users: 10, products: Infinity, aiQueriesPerDay: Infinity },
  ENTERPRISE: { users: Infinity, products: Infinity, aiQueriesPerDay: Infinity },
};
