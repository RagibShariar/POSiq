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

// Monthly price in BDT. No payment gateway in MVP — upgrades are recorded as
// billing records and collected out-of-band. ENTERPRISE is custom/contact-us.
export const PLAN_PRICES: Record<PlanType, number> = {
  FREE: 0,
  STARTER: 999,
  PRO: 2999,
  ENTERPRISE: 0,
};
